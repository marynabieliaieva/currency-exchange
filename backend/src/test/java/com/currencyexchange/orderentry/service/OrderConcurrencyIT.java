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
    void fillRacingCancelLeavesOrderInAConsistentState() throws Exception {
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

            if (fillResult instanceof Order && cancelResult instanceof Order) {
                throw new AssertionError("both fill and cancel reported success against the same order");
            }
            boolean fillWon = fillResult instanceof Order;
            boolean cancelWon = cancelResult instanceof Order;
            assertThat(fillWon ^ cancelWon).as("exactly one of fill/cancel took effect").isTrue();

            if (cancelWon) {
                assertThat(finalOrder.getStatus().name()).isEqualTo("CANCELLED");
                assertThat(cancelResult).isInstanceOf(Order.class);
                assertThat(fillResult).isInstanceOf(OrderNotOpenException.class);
            } else {
                assertThat(finalOrder.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("50"));
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
