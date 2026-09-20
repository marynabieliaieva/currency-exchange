package com.currencyexchange.orderentry.model;

import java.math.BigDecimal;
import java.time.Instant;

public class FillEvent {

    private BigDecimal amount;
    private Instant timestamp;

    public FillEvent() {
    }

    public FillEvent(BigDecimal amount, Instant timestamp) {
        this.amount = amount;
        this.timestamp = timestamp;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
