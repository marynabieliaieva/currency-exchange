package com.currencyexchange.orderentry.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotNull;

public class FillRequest {

    @NotNull
    private BigDecimal amount;

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
