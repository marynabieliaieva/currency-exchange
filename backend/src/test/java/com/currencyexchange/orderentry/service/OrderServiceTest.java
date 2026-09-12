package com.currencyexchange.orderentry.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.currencyexchange.orderentry.dto.CreateOrderRequest;
import com.currencyexchange.orderentry.exception.OrderNotFoundException;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderSide;
import com.currencyexchange.orderentry.model.OrderStatus;
import com.currencyexchange.orderentry.model.OrderType;
import com.currencyexchange.orderentry.repository.OrderRepository;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Test
    void createOrderSavesPendingOrder() {
        OrderService service = new OrderService(orderRepository);
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
        OrderService service = new OrderService(orderRepository);
        when(orderRepository.findById("missing-id")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancelOrder("missing-id"))
                .isInstanceOf(OrderNotFoundException.class);
    }
}
