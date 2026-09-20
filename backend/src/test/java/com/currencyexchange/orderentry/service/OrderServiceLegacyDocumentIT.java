package com.currencyexchange.orderentry.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Date;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;

import com.currencyexchange.orderentry.IntegrationTestSupport;
import com.currencyexchange.orderentry.model.Order;

import java.math.BigDecimal;

/**
 * A genuinely pre-feature order has neither {@code remainingAmount} nor
 * {@code fillEvents} in its stored document (data-model.md) — not merely
 * {@code null}/empty values written by this feature's own code. Every other
 * fixture in this suite persists an {@link Order} instance, which always
 * carries the {@code fillEvents} field's default empty list; only a raw,
 * hand-built {@link Document} reproduces the field being absent altogether.
 */
class OrderServiceLegacyDocumentIT extends IntegrationTestSupport {

    @Autowired
    private OrderService orderService;

    @Autowired
    private MongoTemplate mongoTemplate;

    private String insertLegacyOrder() {
        ObjectId id = new ObjectId();
        Document raw = new Document("_id", id)
                .append("currencyPair", "EUR/USD")
                .append("side", "BUY")
                .append("type", "TAKE_PROFIT")
                .append("triggerPrice", "1.08500000")
                .append("amount", "1000.00000000")
                .append("status", "PENDING")
                .append("createdAt", Date.from(Instant.now()));
        mongoTemplate.getCollection("orders").insertOne(raw);
        return id.toHexString();
    }

    @Test
    void getOrderTreatsAMissingRemainingAmountAndFillEventsAsAmountAndEmpty() {
        String id = insertLegacyOrder();

        Order result = orderService.getOrder(id);

        assertThat(result.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("1000"));
        assertThat(result.getFillEvents()).isEmpty();
    }

    @Test
    void amendOrderOnALegacyDocumentStillReturnsANonNullRemainingAmount() {
        String id = insertLegacyOrder();

        Order result = orderService.amendOrder(id, new BigDecimal("1.09"), null);

        assertThat(result.getRemainingAmount()).isEqualByComparingTo(new BigDecimal("1000"));
        assertThat(result.getTriggerPrice()).isEqualByComparingTo(new BigDecimal("1.09"));
    }
}
