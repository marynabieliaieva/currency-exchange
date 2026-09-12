package com.currencyexchange.orderentry.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;

import com.currencyexchange.orderentry.IntegrationTestSupport;
import com.currencyexchange.orderentry.model.FillEvent;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderSide;
import com.currencyexchange.orderentry.model.OrderStatus;
import com.currencyexchange.orderentry.model.OrderType;

class OrderMongoOperationsIntegrationTest extends IntegrationTestSupport {

    @Autowired
    private MongoTemplate mongoTemplate;

    private OrderMongoOperations orderMongoOperations;

    private Order pendingOrder(BigDecimal amount, BigDecimal remaining) {
        Order order = new Order("EUR/USD", OrderSide.BUY, OrderType.TAKE_PROFIT,
                new BigDecimal("1.08500000"), amount);
        order.setRemainingAmount(remaining);
        return mongoTemplate.save(order);
    }

    @Test
    void tryCancelSetsStatusWhenPending() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = pendingOrder(new BigDecimal("1000"), new BigDecimal("1000"));

        Optional<Order> result = orderMongoOperations.tryCancel(order.getId());

        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo(OrderStatus.CANCELLED);
    }

    @Test
    void tryCancelReturnsEmptyWhenNotPending() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = pendingOrder(new BigDecimal("1000"), new BigDecimal("1000"));
        order.setStatus(OrderStatus.CANCELLED);
        mongoTemplate.save(order);

        Optional<Order> result = orderMongoOperations.tryCancel(order.getId());

        assertThat(result).isEmpty();
    }

    @Test
    void tryFillDecrementsRemainingAndAppendsFillEvent() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = pendingOrder(new BigDecimal("1000"), new BigDecimal("1000"));

        Optional<Order> result = orderMongoOperations.tryFill(order.getId(), new BigDecimal("400"));

        assertThat(result).isPresent();
        assertThat(result.get().getRemainingAmount()).isEqualByComparingTo(new BigDecimal("600"));
        assertThat(result.get().getFillEvents()).hasSize(1);
        assertThat(result.get().getFillEvents().get(0).getAmount()).isEqualByComparingTo(new BigDecimal("400"));
        assertThat(result.get().getStatus()).isEqualTo(OrderStatus.PENDING);
    }

    @Test
    void tryFillSetsFilledWhenRemainingReachesZero() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = pendingOrder(new BigDecimal("1000"), new BigDecimal("400"));

        Optional<Order> result = orderMongoOperations.tryFill(order.getId(), new BigDecimal("400"));

        assertThat(result).isPresent();
        assertThat(result.get().getRemainingAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.get().getStatus()).isEqualTo(OrderStatus.FILLED);
    }

    @Test
    void tryFillRejectsAmountExceedingRemaining() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = pendingOrder(new BigDecimal("1000"), new BigDecimal("300"));

        Optional<Order> result = orderMongoOperations.tryFill(order.getId(), new BigDecimal("400"));

        assertThat(result).isEmpty();
        Order unchanged = mongoTemplate.findById(order.getId(), Order.class);
        assertThat(unchanged.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("300"));
        assertThat(unchanged.getFillEvents()).isEmpty();
    }

    @Test
    void tryFillUsesAmountAsEffectiveRemainingWhenNeverRecorded() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = pendingOrder(new BigDecimal("1000"), null);

        Optional<Order> result = orderMongoOperations.tryFill(order.getId(), new BigDecimal("1000"));

        assertThat(result).isPresent();
        assertThat(result.get().getRemainingAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.get().getStatus()).isEqualTo(OrderStatus.FILLED);
    }

    @Test
    void tryAmendUpdatesPriceAndRemainingWhenValid() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = pendingOrder(new BigDecimal("1000"), new BigDecimal("1000"));

        Optional<Order> result = orderMongoOperations.tryAmend(order.getId(), new BigDecimal("1.09000000"), new BigDecimal("500"));

        assertThat(result).isPresent();
        assertThat(result.get().getTriggerPrice()).isEqualByComparingTo(new BigDecimal("1.09"));
        assertThat(result.get().getRemainingAmount()).isEqualByComparingTo(new BigDecimal("500"));
    }

    @Test
    void tryAmendRejectsRemainingAboveAvailable() {
        orderMongoOperations = new OrderMongoOperations(mongoTemplate);
        Order order = new Order("EUR/USD", OrderSide.BUY, OrderType.TAKE_PROFIT,
                new BigDecimal("1.08500000"), new BigDecimal("1000"));
        order.setRemainingAmount(new BigDecimal("600"));
        order.setFillEvents(List.of(new FillEvent(new BigDecimal("400"), Instant.now())));
        order = mongoTemplate.save(order);

        Optional<Order> result = orderMongoOperations.tryAmend(order.getId(), null, new BigDecimal("700"));

        assertThat(result).isEmpty();
    }
}
