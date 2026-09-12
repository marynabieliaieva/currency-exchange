package com.currencyexchange.orderentry.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.currencyexchange.orderentry.dto.AmendRequest;
import com.currencyexchange.orderentry.dto.CreateOrderRequest;
import com.currencyexchange.orderentry.dto.FillRequest;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.service.OrderService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<Order> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        Order created = orderService.createOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public List<Order> listOrders() {
        return orderService.listOrders();
    }

    @GetMapping("/{id}")
    public Order getOrder(@PathVariable String id) {
        return orderService.getOrder(id);
    }

    @DeleteMapping("/{id}")
    public Order cancelOrder(@PathVariable String id) {
        return orderService.cancelOrder(id);
    }

    @PostMapping("/{id}/fills")
    public ResponseEntity<Order> recordFill(@PathVariable String id, @Valid @RequestBody FillRequest request) {
        Order filled = orderService.fillOrder(id, request.getAmount());
        return ResponseEntity.status(HttpStatus.CREATED).body(filled);
    }

    @PatchMapping("/{id}")
    public Order amendOrder(@PathVariable String id, @Valid @RequestBody AmendRequest request) {
        return orderService.amendOrder(id, request.getTriggerPrice(), request.getRemainingAmount());
    }
}
