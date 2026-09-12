package com.currencyexchange.orderentry.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.stereotype.Service;

import com.currencyexchange.orderentry.dto.CreateOrderRequest;
import com.currencyexchange.orderentry.exception.OrderNotFoundException;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderStatus;
import com.currencyexchange.orderentry.repository.OrderRepository;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    private static final int AMOUNT_SCALE = 8;

    public Order createOrder(CreateOrderRequest request) {
        BigDecimal amount = normalize(request.getAmount());
        Order order = new Order(
                request.getCurrencyPair(),
                request.getSide(),
                request.getType(),
                normalize(request.getTriggerPrice()),
                amount);
        order.setRemainingAmount(amount);
        return orderRepository.save(order);
    }

    private static BigDecimal normalize(BigDecimal value) {
        return value.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
    }

    public List<Order> listOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc();
    }

    public Order getOrder(String id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }

    public Order cancelOrder(String id) {
        Order order = getOrder(id);
        order.setStatus(OrderStatus.CANCELLED);
        return orderRepository.save(order);
    }
}
