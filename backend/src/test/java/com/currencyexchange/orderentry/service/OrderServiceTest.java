package com.currencyexchange.orderentry.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.currencyexchange.orderentry.dto.CreateOrderRequest;
import com.currencyexchange.orderentry.exception.InvalidAmendException;
import com.currencyexchange.orderentry.exception.InvalidFillAmountException;
import com.currencyexchange.orderentry.exception.OrderNotFoundException;
import com.currencyexchange.orderentry.exception.OrderNotOpenException;
import com.currencyexchange.orderentry.model.FillEvent;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderSide;
import com.currencyexchange.orderentry.model.OrderStatus;
import com.currencyexchange.orderentry.model.OrderType;
import com.currencyexchange.orderentry.repository.OrderMongoOperations;
import com.currencyexchange.orderentry.repository.OrderRepository;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderMongoOperations orderMongoOperations;

    private OrderService service() {
        return new OrderService(orderRepository, orderMongoOperations);
    }

    private Order pendingOrder(String id, BigDecimal amount, BigDecimal remaining) {
        Order order = new Order("EUR/USD", OrderSide.BUY, OrderType.TAKE_PROFIT, new BigDecimal("1.08500000"), amount);
        order.setId(id);
        order.setRemainingAmount(remaining);
        return order;
    }

    @Test
    void createOrderSavesPendingOrder() {
        OrderService service = service();
        CreateOrderRequest request = new CreateOrderRequest();
        request.setCurrencyPair("EUR/USD");
        request.setSide(OrderSide.BUY);
        request.setType(OrderType.TAKE_PROFIT);
        request.setTriggerPrice(new BigDecimal("1.0850"));
        request.setAmount(new BigDecimal("1000"));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order created = service.createOrder(request);

        assertThat(created.getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(created.getCurrencyPair()).isEqualTo("EUR/USD");
        assertThat(created.getType()).isEqualTo(OrderType.TAKE_PROFIT);
    }

    @Test
    void cancelOrderThrowsWhenMissing() {
        OrderService service = service();
        when(orderMongoOperations.tryCancel("missing-id")).thenReturn(Optional.empty());
        when(orderRepository.findById("missing-id")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancelOrder("missing-id"))
                .isInstanceOf(OrderNotFoundException.class);
    }

    @Test
    void createOrderSetsRemainingAmountToNormalizedScaleEightAndNoFillEvents() {
        OrderService service = service();
        CreateOrderRequest request = new CreateOrderRequest();
        request.setCurrencyPair("EUR/USD");
        request.setSide(OrderSide.BUY);
        request.setType(OrderType.TAKE_PROFIT);
        request.setTriggerPrice(new BigDecimal("1.085"));
        request.setAmount(new BigDecimal("1000"));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order created = service.createOrder(request);

        assertThat(created.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("1000"));
        assertThat(created.getRemainingAmount().scale()).isEqualTo(8);
        assertThat(created.getAmount().scale()).isEqualTo(8);
        assertThat(created.getTriggerPrice().scale()).isEqualTo(8);
        assertThat(created.getFillEvents()).isEmpty();
        assertThat(created.getStatus()).isEqualTo(OrderStatus.PENDING);
    }

    @Test
    void filledStatusExistsOnEnum() {
        assertThat(OrderStatus.valueOf("FILLED")).isEqualTo(OrderStatus.FILLED);
    }

    // --- cancelOrder (AC-01, AC-02, AC-10) ---

    @Test
    void cancelOrderReturnsCancelledOrderOnSuccess() {
        OrderService service = service();
        Order cancelled = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("1000"));
        cancelled.setStatus(OrderStatus.CANCELLED);
        when(orderMongoOperations.tryCancel("id-1")).thenReturn(Optional.of(cancelled));

        Order result = service.cancelOrder("id-1");

        assertThat(result.getStatus()).isEqualTo(OrderStatus.CANCELLED);
    }

    @Test
    void cancelOrderThrowsOrderNotOpenWhenAlreadyClosed() {
        OrderService service = service();
        when(orderMongoOperations.tryCancel("id-1")).thenReturn(Optional.empty());
        Order closed = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("1000"));
        closed.setStatus(OrderStatus.FILLED);
        when(orderRepository.findById("id-1")).thenReturn(Optional.of(closed));

        assertThatThrownBy(() -> service.cancelOrder("id-1"))
                .isInstanceOf(OrderNotOpenException.class);
    }

    // --- fillOrder (AC-03, AC-04, AC-10, AC-11) ---

    @Test
    void fillOrderRejectsZeroOrNegativeAmountBeforeAnyDbCall() {
        OrderService service = service();

        assertThatThrownBy(() -> service.fillOrder("id-1", BigDecimal.ZERO))
                .isInstanceOf(InvalidFillAmountException.class);
        assertThatThrownBy(() -> service.fillOrder("id-1", new BigDecimal("-5")))
                .isInstanceOf(InvalidFillAmountException.class);
    }

    @Test
    void fillOrderRejectsSubScaleAmountThatNormalizesToZeroBeforeAnyDbCall() {
        OrderService service = service();

        assertThatThrownBy(() -> service.fillOrder("id-1", new BigDecimal("0.000000001")))
                .isInstanceOf(InvalidFillAmountException.class);
    }

    @Test
    void fillOrderReturnsUpdatedOrderOnSuccess() {
        OrderService service = service();
        Order filled = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("600"));
        filled.setFillEvents(List.of(new FillEvent(new BigDecimal("400"), Instant.now())));
        when(orderMongoOperations.tryFill(eq("id-1"), eq(new BigDecimal("400.00000000")))).thenReturn(Optional.of(filled));

        Order result = service.fillOrder("id-1", new BigDecimal("400"));

        assertThat(result.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("600"));
    }

    @Test
    void fillOrderThrowsOrderNotOpenWhenClosed() {
        OrderService service = service();
        when(orderMongoOperations.tryFill(eq("id-1"), any())).thenReturn(Optional.empty());
        Order closed = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("600"));
        closed.setStatus(OrderStatus.CANCELLED);
        when(orderRepository.findById("id-1")).thenReturn(Optional.of(closed));

        assertThatThrownBy(() -> service.fillOrder("id-1", new BigDecimal("400")))
                .isInstanceOf(OrderNotOpenException.class);
    }

    @Test
    void fillOrderThrowsInvalidFillAmountWhenExceedsRemaining() {
        OrderService service = service();
        when(orderMongoOperations.tryFill(eq("id-1"), any())).thenReturn(Optional.empty());
        Order stillPending = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("300"));
        when(orderRepository.findById("id-1")).thenReturn(Optional.of(stillPending));

        assertThatThrownBy(() -> service.fillOrder("id-1", new BigDecimal("400")))
                .isInstanceOf(InvalidFillAmountException.class);
    }

    @Test
    void fillOrderThrowsOrderNotFoundWhenMissing() {
        OrderService service = service();
        when(orderMongoOperations.tryFill(eq("missing-id"), any())).thenReturn(Optional.empty());
        when(orderRepository.findById("missing-id")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.fillOrder("missing-id", new BigDecimal("100")))
                .isInstanceOf(OrderNotFoundException.class);
    }

    // --- amendOrder (AC-06, AC-07, AC-10, AC-12) ---

    @Test
    void amendOrderRejectsNonPositiveRemainingBeforeAnyDbCall() {
        OrderService service = service();

        assertThatThrownBy(() -> service.amendOrder("id-1", null, BigDecimal.ZERO))
                .isInstanceOf(InvalidAmendException.class);
        assertThatThrownBy(() -> service.amendOrder("id-1", null, new BigDecimal("-1")))
                .isInstanceOf(InvalidAmendException.class);
    }

    @Test
    void amendOrderReturnsUpdatedOrderOnSuccess() {
        OrderService service = service();
        Order amended = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("500"));
        amended.setTriggerPrice(new BigDecimal("1.09000000"));
        when(orderMongoOperations.tryAmend(eq("id-1"), eq(new BigDecimal("1.09000000")), eq(new BigDecimal("500.00000000"))))
                .thenReturn(Optional.of(amended));

        Order result = service.amendOrder("id-1", new BigDecimal("1.09"), new BigDecimal("500"));

        assertThat(result.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("500"));
    }

    @Test
    void amendOrderThrowsOrderNotOpenWhenClosed() {
        OrderService service = service();
        when(orderMongoOperations.tryAmend(eq("id-1"), any(), any())).thenReturn(Optional.empty());
        Order closed = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("600"));
        closed.setStatus(OrderStatus.CANCELLED);
        when(orderRepository.findById("id-1")).thenReturn(Optional.of(closed));

        assertThatThrownBy(() -> service.amendOrder("id-1", null, new BigDecimal("500")))
                .isInstanceOf(OrderNotOpenException.class);
    }

    @Test
    void amendOrderThrowsInvalidAmendWhenRemainingAboveAvailable() {
        OrderService service = service();
        when(orderMongoOperations.tryAmend(eq("id-1"), any(), any())).thenReturn(Optional.empty());
        Order stillPending = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("600"));
        when(orderRepository.findById("id-1")).thenReturn(Optional.of(stillPending));

        assertThatThrownBy(() -> service.amendOrder("id-1", null, new BigDecimal("700")))
                .isInstanceOf(InvalidAmendException.class);
    }

    @Test
    void amendOrderRejectionMessageUsesAmountMinusFilledNotCurrentRemaining() {
        OrderService service = service();
        when(orderMongoOperations.tryAmend(eq("id-1"), any(), any())).thenReturn(Optional.empty());
        // A prior downward amend left remainingAmount at 300, but only 400 has actually been
        // filled — the reported ceiling must be 1000-400=600, not the stale 300.
        Order stillPending = pendingOrder("id-1", new BigDecimal("1000"), new BigDecimal("300"));
        stillPending.setFillEvents(List.of(new FillEvent(new BigDecimal("400"), Instant.now())));
        when(orderRepository.findById("id-1")).thenReturn(Optional.of(stillPending));

        assertThatThrownBy(() -> service.amendOrder("id-1", null, new BigDecimal("601")))
                .isInstanceOf(InvalidAmendException.class)
                .hasMessageContaining("600");
    }

    // --- AC-11 read-path fallback ---

    @Test
    void getOrderAppliesRemainingAmountFallbackWhenNeverRecorded() {
        OrderService service = service();
        Order legacy = pendingOrder("id-1", new BigDecimal("1000"), null);
        when(orderRepository.findById("id-1")).thenReturn(Optional.of(legacy));

        Order result = service.getOrder("id-1");

        assertThat(result.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("1000"));
    }

    @Test
    void listOrdersAppliesRemainingAmountFallbackWhenNeverRecorded() {
        OrderService service = service();
        Order legacy = pendingOrder("id-1", new BigDecimal("1000"), null);
        when(orderRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(legacy));

        List<Order> result = service.listOrders();

        assertThat(result.get(0).getRemainingAmount()).isEqualByComparingTo(new BigDecimal("1000"));
    }
}
