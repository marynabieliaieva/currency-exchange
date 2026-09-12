package com.currencyexchange.orderentry.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.currencyexchange.orderentry.IntegrationTestSupport;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderSide;
import com.currencyexchange.orderentry.model.OrderType;

class OrderRepositoryIntegrationTest extends IntegrationTestSupport {

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void savesAndReadsBackAnOrderThroughTheRealRepository() {
        Order order = new Order("EUR/USD", OrderSide.BUY, OrderType.TAKE_PROFIT,
                new BigDecimal("1.0850"), new BigDecimal("1000"));

        Order saved = orderRepository.save(order);
        Order found = orderRepository.findById(saved.getId()).orElseThrow();

        assertThat(found.getCurrencyPair()).isEqualTo("EUR/USD");
        assertThat(found.getAmount()).isEqualByComparingTo(new BigDecimal("1000"));
    }
}
