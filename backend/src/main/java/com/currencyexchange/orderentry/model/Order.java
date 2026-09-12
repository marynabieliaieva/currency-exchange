package com.currencyexchange.orderentry.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("orders")
public class Order {

    @Id
    private String id;

    private String currencyPair;
    private OrderSide side;
    private OrderType type;
    private BigDecimal triggerPrice;
    private BigDecimal amount;
    private BigDecimal remainingAmount;
    private OrderStatus status;
    private Instant createdAt;
    private List<FillEvent> fillEvents = new ArrayList<>();

    public Order() {
    }

    public Order(String currencyPair, OrderSide side, OrderType type, BigDecimal triggerPrice, BigDecimal amount) {
        this.currencyPair = currencyPair;
        this.side = side;
        this.type = type;
        this.triggerPrice = triggerPrice;
        this.amount = amount;
        this.status = OrderStatus.PENDING;
        this.createdAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCurrencyPair() {
        return currencyPair;
    }

    public void setCurrencyPair(String currencyPair) {
        this.currencyPair = currencyPair;
    }

    public OrderSide getSide() {
        return side;
    }

    public void setSide(OrderSide side) {
        this.side = side;
    }

    public OrderType getType() {
        return type;
    }

    public void setType(OrderType type) {
        this.type = type;
    }

    public BigDecimal getTriggerPrice() {
        return triggerPrice;
    }

    public void setTriggerPrice(BigDecimal triggerPrice) {
        this.triggerPrice = triggerPrice;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public BigDecimal getRemainingAmount() {
        return remainingAmount;
    }

    public void setRemainingAmount(BigDecimal remainingAmount) {
        this.remainingAmount = remainingAmount;
    }

    public List<FillEvent> getFillEvents() {
        return fillEvents;
    }

    public void setFillEvents(List<FillEvent> fillEvents) {
        this.fillEvents = fillEvents;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
