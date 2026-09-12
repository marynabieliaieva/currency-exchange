package com.currencyexchange.orderentry.exception;

public class InvalidFillAmountException extends RuntimeException {

    public enum Reason {
        NOT_POSITIVE,
        EXCEEDS_REMAINING
    }

    private final Reason reason;

    public InvalidFillAmountException(String message, Reason reason) {
        super(message);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}
