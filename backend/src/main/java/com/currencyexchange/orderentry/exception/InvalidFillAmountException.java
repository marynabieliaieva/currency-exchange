package com.currencyexchange.orderentry.exception;

public class InvalidFillAmountException extends RuntimeException {

    public InvalidFillAmountException(String message) {
        super(message);
    }
}
