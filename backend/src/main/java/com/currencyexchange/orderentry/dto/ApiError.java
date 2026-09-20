package com.currencyexchange.orderentry.dto;

import java.time.Instant;
import java.util.List;

public record ApiError(Instant timestamp, int status, String error, List<String> messages, String code) {

    public static ApiError of(int status, String error, List<String> messages) {
        return new ApiError(Instant.now(), status, error, messages, null);
    }

    public static ApiError of(int status, String error, List<String> messages, String code) {
        return new ApiError(Instant.now(), status, error, messages, code);
    }
}
