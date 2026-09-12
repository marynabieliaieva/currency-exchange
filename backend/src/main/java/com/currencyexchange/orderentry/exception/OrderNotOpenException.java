package com.currencyexchange.orderentry.exception;

public class OrderNotOpenException extends RuntimeException {

    public OrderNotOpenException(String orderId, String currentStatus) {
        super("Order " + orderId + " is no longer open (status: " + currentStatus + ")");
    }
}
