package com.currencyexchange.orderentry.dto;

import java.math.BigDecimal;

import com.currencyexchange.orderentry.model.OrderSide;
import com.currencyexchange.orderentry.model.OrderType;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public class CreateOrderRequest {

    @NotNull
    @Pattern(regexp = "^[A-Z]{3}/[A-Z]{3}$", message = "currencyPair must look like EUR/USD")
    private String currencyPair;

    @NotNull
    private OrderSide side;

    @NotNull
    private OrderType type;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false, message = "triggerPrice must be greater than 0")
    private BigDecimal triggerPrice;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false, message = "amount must be greater than 0")
    private BigDecimal amount;

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
}
