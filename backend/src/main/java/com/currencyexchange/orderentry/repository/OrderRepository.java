package com.currencyexchange.orderentry.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.currencyexchange.orderentry.model.Order;

public interface OrderRepository extends MongoRepository<Order, String> {

    List<Order> findAllByOrderByCreatedAtDesc();
}
