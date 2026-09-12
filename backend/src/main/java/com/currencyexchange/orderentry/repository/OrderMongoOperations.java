package com.currencyexchange.orderentry.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderStatus;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;

/**
 * Guarded, atomic conditional updates for cancel/fill/amend (ADR-0001), each a
 * single {@code findOneAndUpdate} — MongoDB evaluates the guard against the
 * live document at write time, so two concurrent actions on the same order
 * are serialized by Mongo itself with no read-then-write race window.
 *
 * <p>Amount fields ({@code amount}, {@code remainingAmount}, {@code
 * FillEvent.amount}) are persisted as plain BSON strings — this repo's
 * existing convention (Spring Data's default {@code BigDecimal}-to-{@code
 * String} conversion; no custom {@code MongoCustomConversions} is registered
 * anywhere). Guards and the fill decrement therefore go through {@code
 * $toDecimal}/{@code $toString} — both the match filter (via {@code $expr})
 * and, for {@link #tryFill}, an update-with-aggregation-pipeline — so every
 * comparison and computation reads the document's own live field at write
 * time rather than a client-side snapshot, without changing the storage
 * convention.
 */
@Component
public class OrderMongoOperations {

    private final MongoTemplate mongoTemplate;

    public OrderMongoOperations(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public Optional<Order> tryCancel(String id) {
        Document filter = pendingFilter(id);
        Document update = new Document("$set", new Document("status", OrderStatus.CANCELLED.name()));
        return findAndModify(filter, update);
    }

    public Optional<Order> tryFill(String id, BigDecimal amount) {
        String amountStr = amount.toPlainString();

        Document filter = pendingFilter(id).append("$expr", gte(effectiveRemaining(), toDecimal(amountStr)));

        List<Bson> pipeline = new ArrayList<>();
        pipeline.add(setStage("remainingAmount",
                new Document("$toString", new Document("$subtract", List.of(effectiveRemaining(), toDecimal(amountStr))))));
        pipeline.add(setStage("status",
                new Document("$cond", List.of(
                        new Document("$eq", List.of(toDecimal("$remainingAmount"), toDecimal("0"))),
                        OrderStatus.FILLED.name(),
                        "$status"))));
        pipeline.add(setStage("fillEvents",
                new Document("$concatArrays", List.of(
                        new Document("$ifNull", List.of("$fillEvents", List.of())),
                        List.of(new Document("amount", amountStr).append("timestamp", Date.from(Instant.now())))))));

        return findAndModifyPipeline(filter, pipeline);
    }

    public Optional<Order> tryAmend(String id, BigDecimal newPrice, BigDecimal newRemaining) {
        if (newRemaining != null && newRemaining.compareTo(BigDecimal.ZERO) <= 0) {
            return Optional.empty();
        }

        Document filter = pendingFilter(id);
        if (newRemaining != null) {
            filter.append("$expr", gte(effectiveRemaining(), toDecimal(newRemaining.toPlainString())));
        }

        Document set = new Document();
        if (newPrice != null) {
            set.append("triggerPrice", newPrice.toPlainString());
        }
        if (newRemaining != null) {
            set.append("remainingAmount", newRemaining.toPlainString());
        }
        return findAndModify(filter, new Document("$set", set));
    }

    private static Document pendingFilter(String id) {
        return new Document("_id", new ObjectId(id)).append("status", OrderStatus.PENDING.name());
    }

    private static Document effectiveRemaining() {
        return toDecimal(new Document("$ifNull", List.of("$remainingAmount", "$amount")));
    }

    private static Document toDecimal(Object value) {
        return new Document("$toDecimal", value);
    }

    private static Document gte(Object left, Object right) {
        return new Document("$gte", List.of(left, right));
    }

    private static Document setStage(String field, Object expression) {
        return new Document("$set", new Document(field, expression));
    }

    private Optional<Order> findAndModify(Document filter, Document update) {
        Document result = mongoTemplate.getCollection("orders").findOneAndUpdate(
                filter, update, new FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER));
        return toOrder(result);
    }

    private Optional<Order> findAndModifyPipeline(Document filter, List<Bson> pipeline) {
        Document result = mongoTemplate.getCollection("orders").findOneAndUpdate(
                filter, pipeline, new FindOneAndUpdateOptions().returnDocument(ReturnDocument.AFTER));
        return toOrder(result);
    }

    private Optional<Order> toOrder(Document document) {
        if (document == null) {
            return Optional.empty();
        }
        return Optional.of(mongoTemplate.getConverter().read(Order.class, document));
    }
}
