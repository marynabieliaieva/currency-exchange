package com.currencyexchange.orderentry.service;

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

    public Order createOrder(CreateOrderRequest request) {
        Order order = new Order(
                request.getCurrencyPair(),
                request.getSide(),
                request.getType(),
                request.getTriggerPrice(),
                request.getAmount());
        return orderRepository.save(order);
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
