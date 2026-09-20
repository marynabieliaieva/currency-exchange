package com.currencyexchange.orderentry.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.currencyexchange.orderentry.IntegrationTestSupport;
import com.currencyexchange.orderentry.exception.InvalidFillAmountException;
import com.currencyexchange.orderentry.exception.OrderNotOpenException;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderSide;
import com.currencyexchange.orderentry.model.OrderType;
import com.currencyexchange.orderentry.repository.OrderRepository;

/**
 * Proves AC-05/AC-13 hold against a real MongoDB under genuine concurrent
 * load, not just in the mocked unit tests — the atomic conditional update
 * (ADR-0001) is what serializes the two racing requests, no application-level
 * locking involved.
 */
class OrderConcurrencyIT extends IntegrationTestSupport {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    private Order seedPendingOrder(BigDecimal remaining) {
        Order order = new Order("EUR/USD", OrderSide.BUY, OrderType.TAKE_PROFIT,
                new BigDecimal("1.08500000"), remaining);
        order.setRemainingAmount(remaining);
        return orderRepository.save(order);
    }

    @Test
    void exactlyOneOfTwoConcurrentOverfillingFillsSucceeds() throws Exception {
        Order order = seedPendingOrder(new BigDecimal("100"));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<Object> fillA = CompletableFuture.supplyAsync(
                    () -> tryFill(order.getId(), new BigDecimal("70")), pool);
            CompletableFuture<Object> fillB = CompletableFuture.supplyAsync(
                    () -> tryFill(order.getId(), new BigDecimal("70")), pool);
            CompletableFuture.allOf(fillA, fillB).join();

            List<Object> results = List.of(fillA.join(), fillB.join());
            long successes = results.stream().filter(r -> r instanceof Order).count();
            long rejections = results.stream().filter(r -> r instanceof InvalidFillAmountException).count();

            assertThat(successes).isEqualTo(1);
            assertThat(rejections).isEqualTo(1);

            Order finalOrder = orderRepository.findById(order.getId()).orElseThrow();
            assertThat(finalOrder.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("30"));
            assertThat(finalOrder.getRemainingAmount()).isGreaterThanOrEqualTo(BigDecimal.ZERO);
        } finally {
            pool.shutdown();
        }
    }

    @Test
    void partialFillRacingCancelLeavesOrderInAConsistentState() throws Exception {
        // A partial fill (50 of 100) never closes the order on its own (AC-11), so a
        // cancel that lands after it is the legitimate cancel-with-forfeiture flow
        // (AC-02) — both actions are allowed to succeed here, as long as the final
        // state is one of the three consistent outcomes below.
        Order order = seedPendingOrder(new BigDecimal("100"));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<Object> fill = CompletableFuture.supplyAsync(
                    () -> tryFill(order.getId(), new BigDecimal("50")), pool);
            CompletableFuture<Object> cancel = CompletableFuture.supplyAsync(
                    () -> tryCancel(order.getId()), pool);
            CompletableFuture.allOf(fill, cancel).join();

            Object fillResult = fill.join();
            Object cancelResult = cancel.join();

            Order finalOrder = orderRepository.findById(order.getId()).orElseThrow();
            boolean fillWon = fillResult instanceof Order;
            boolean cancelWon = cancelResult instanceof Order;

            if (fillWon && cancelWon) {
                // fill landed first (order stayed PENDING with fill events), then
                // cancel forfeited the rest (AC-02): status flips, remaining is left
                // exactly as the fill left it.
                assertThat(finalOrder.getStatus().name()).isEqualTo("CANCELLED");
                assertThat(finalOrder.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("50"));
            } else if (cancelWon) {
                // cancel landed first and closed the order before the fill could apply.
                assertThat(finalOrder.getStatus().name()).isEqualTo("CANCELLED");
                assertThat(finalOrder.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("100"));
                assertThat(fillResult).isInstanceOf(OrderNotOpenException.class);
            } else {
                assertThat(fillWon).as("at least one of fill/cancel must take effect").isTrue();
                assertThat(finalOrder.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("50"));
                assertThat(cancelResult).isInstanceOf(OrderNotOpenException.class);
            }
        } finally {
            pool.shutdown();
        }
    }

    @Test
    void fullFillRacingCancelExactlyOneSucceeds() throws Exception {
        // A full fill (100 of 100) closes the order (AC-11 auto-transition to
        // FILLED), so unlike the partial-fill case, fill and cancel here are
        // mutually exclusive: once one takes effect the order is no longer PENDING
        // and the other must be rejected (AC-13).
        Order order = seedPendingOrder(new BigDecimal("100"));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<Object> fill = CompletableFuture.supplyAsync(
                    () -> tryFill(order.getId(), new BigDecimal("100")), pool);
            CompletableFuture<Object> cancel = CompletableFuture.supplyAsync(
                    () -> tryCancel(order.getId()), pool);
            CompletableFuture.allOf(fill, cancel).join();

            Object fillResult = fill.join();
            Object cancelResult = cancel.join();

            Order finalOrder = orderRepository.findById(order.getId()).orElseThrow();

            boolean fillWon = fillResult instanceof Order;
            boolean cancelWon = cancelResult instanceof Order;
            assertThat(fillWon ^ cancelWon).as("exactly one of fill/cancel took effect").isTrue();

            if (cancelWon) {
                assertThat(finalOrder.getStatus().name()).isEqualTo("CANCELLED");
                assertThat(finalOrder.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("100"));
                assertThat(fillResult).isInstanceOf(OrderNotOpenException.class);
            } else {
                assertThat(finalOrder.getStatus().name()).isEqualTo("FILLED");
                assertThat(finalOrder.getRemainingAmount()).isEqualByComparingTo(BigDecimal.ZERO);
                assertThat(cancelResult).isInstanceOf(OrderNotOpenException.class);
            }
        } finally {
            pool.shutdown();
        }
    }

    private Object tryFill(String id, BigDecimal amount) {
        try {
            return orderService.fillOrder(id, amount);
        } catch (InvalidFillAmountException | OrderNotOpenException ex) {
            return ex;
        }
    }

    private Object tryCancel(String id) {
        try {
            return orderService.cancelOrder(id);
        } catch (OrderNotOpenException ex) {
            return ex;
        }
    }
}
