package com.currencyexchange.orderentry.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.currencyexchange.orderentry.exception.InvalidAmendException;
import com.currencyexchange.orderentry.exception.InvalidFillAmountException;
import com.currencyexchange.orderentry.exception.OrderNotFoundException;
import com.currencyexchange.orderentry.exception.OrderNotOpenException;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderSide;
import com.currencyexchange.orderentry.model.OrderType;
import com.currencyexchange.orderentry.service.OrderService;

@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    private Order order(String id) {
        Order order = new Order("EUR/USD", OrderSide.BUY, OrderType.TAKE_PROFIT, new BigDecimal("1.08500000"), new BigDecimal("1000"));
        order.setId(id);
        order.setRemainingAmount(new BigDecimal("1000"));
        return order;
    }

    @Test
    void recordFillReturns201OnSuccess() throws Exception {
        when(orderService.fillOrder(anyString(), any())).thenReturn(order("id-1"));

        mockMvc.perform(post("/api/orders/id-1/fills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 250}"))
                .andExpect(status().isCreated());
    }

    @Test
    void recordFillReturns400WithCodeWhenAmountNotPositive() throws Exception {
        when(orderService.fillOrder(anyString(), any()))
                .thenThrow(new InvalidFillAmountException("amount must be greater than 0",
                        InvalidFillAmountException.Reason.NOT_POSITIVE));

        mockMvc.perform(post("/api/orders/id-1/fills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("order.invalid_fill_amount"));
    }

    @Test
    void recordFillReturns409WithNotPendingCodeWhenClosed() throws Exception {
        when(orderService.fillOrder(anyString(), any()))
                .thenThrow(new OrderNotOpenException("id-1", "CANCELLED"));

        mockMvc.perform(post("/api/orders/id-1/fills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 250}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("order.not_pending"));
    }

    @Test
    void recordFillReturns409WithExceedsRemainingCodeWhenOverfilling() throws Exception {
        when(orderService.fillOrder(anyString(), any()))
                .thenThrow(new InvalidFillAmountException("amount exceeds what's left on the order",
                        InvalidFillAmountException.Reason.EXCEEDS_REMAINING));

        mockMvc.perform(post("/api/orders/id-1/fills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 9999}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("order.fill_exceeds_remaining"));
    }

    @Test
    void recordFillReturns404WhenOrderMissing() throws Exception {
        when(orderService.fillOrder(anyString(), any()))
                .thenThrow(new OrderNotFoundException("missing-id"));

        mockMvc.perform(post("/api/orders/missing-id/fills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 250}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void amendOrderReturns200OnSuccess() throws Exception {
        when(orderService.amendOrder(anyString(), any(), any())).thenReturn(order("id-1"));

        mockMvc.perform(patch("/api/orders/id-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"remainingAmount\": 500}"))
                .andExpect(status().isOk());
    }

    @Test
    void amendOrderReturns409WithAmendOutOfRangeCode() throws Exception {
        when(orderService.amendOrder(anyString(), any(), any()))
                .thenThrow(new InvalidAmendException("remainingAmount must be greater than 0 and at most 600.00000000"));

        mockMvc.perform(patch("/api/orders/id-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"remainingAmount\": 700}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("order.amend_out_of_range"));
    }

    @Test
    void amendOrderReturns409WithNotPendingCodeWhenClosed() throws Exception {
        when(orderService.amendOrder(anyString(), any(), any()))
                .thenThrow(new OrderNotOpenException("id-1", "FILLED"));

        mockMvc.perform(patch("/api/orders/id-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"remainingAmount\": 500}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("order.not_pending"));
    }

    @Test
    void cancelOrderReturns200OnSuccess() throws Exception {
        when(orderService.cancelOrder(anyString())).thenReturn(order("id-1"));

        mockMvc.perform(delete("/api/orders/id-1"))
                .andExpect(status().isOk());
    }

    @Test
    void cancelOrderReturns409WhenNotPending() throws Exception {
        when(orderService.cancelOrder(anyString()))
                .thenThrow(new OrderNotOpenException("id-1", "CANCELLED"));

        mockMvc.perform(delete("/api/orders/id-1"))
                .andExpect(status().isConflict());
    }

    @Test
    void cancelOrderReturns404WhenMissing() throws Exception {
        when(orderService.cancelOrder(anyString()))
                .thenThrow(new OrderNotFoundException("missing-id"));

        mockMvc.perform(delete("/api/orders/missing-id"))
                .andExpect(status().isNotFound());
    }
}
