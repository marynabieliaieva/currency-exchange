package com.currencyexchange.orderentry.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;

public class AmendRequest {

    @DecimalMin(value = "0.0", inclusive = false, message = "triggerPrice must be greater than 0")
    private BigDecimal triggerPrice;

    @DecimalMin(value = "0.0", inclusive = false, message = "remainingAmount must be greater than 0")
    private BigDecimal remainingAmount;

    public BigDecimal getTriggerPrice() {
        return triggerPrice;
    }

    public void setTriggerPrice(BigDecimal triggerPrice) {
        this.triggerPrice = triggerPrice;
    }

    public BigDecimal getRemainingAmount() {
        return remainingAmount;
    }

    public void setRemainingAmount(BigDecimal remainingAmount) {
        this.remainingAmount = remainingAmount;
    }

    @AssertTrue(message = "at least one of triggerPrice or remainingAmount must be present")
    public boolean isAtLeastOneFieldPresent() {
        return triggerPrice != null || remainingAmount != null;
    }
}
