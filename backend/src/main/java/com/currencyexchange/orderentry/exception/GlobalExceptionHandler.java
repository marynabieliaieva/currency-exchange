package com.currencyexchange.orderentry.exception;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.currencyexchange.orderentry.dto.ApiError;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        List<String> messages = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .toList();
        return ResponseEntity.badRequest()
                .body(ApiError.of(400, "Validation failed", messages));
    }

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(OrderNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(404, "Not found", List.of(ex.getMessage())));
    }

    @ExceptionHandler(OrderNotOpenException.class)
    public ResponseEntity<ApiError> handleNotOpen(OrderNotOpenException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(409, "Conflict", List.of(ex.getMessage()), "order.not_pending"));
    }

    @ExceptionHandler(InvalidFillAmountException.class)
    public ResponseEntity<ApiError> handleInvalidFillAmount(InvalidFillAmountException ex) {
        boolean notPositive = ex.getReason() == InvalidFillAmountException.Reason.NOT_POSITIVE;
        int status = notPositive ? 400 : 409;
        String code = notPositive ? "order.invalid_fill_amount" : "order.fill_exceeds_remaining";
        return ResponseEntity.status(status)
                .body(ApiError.of(status, notPositive ? "Validation failed" : "Conflict", List.of(ex.getMessage()), code));
    }

    @ExceptionHandler(InvalidAmendException.class)
    public ResponseEntity<ApiError> handleInvalidAmend(InvalidAmendException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(409, "Conflict", List.of(ex.getMessage()), "order.amend_out_of_range"));
    }
}
