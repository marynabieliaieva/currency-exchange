package com.currencyexchange.orderentry.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.currencyexchange.orderentry.dto.CreateOrderRequest;
import com.currencyexchange.orderentry.exception.InvalidAmendException;
import com.currencyexchange.orderentry.exception.InvalidFillAmountException;
import com.currencyexchange.orderentry.exception.OrderNotFoundException;
import com.currencyexchange.orderentry.exception.OrderNotOpenException;
import com.currencyexchange.orderentry.model.Order;
import com.currencyexchange.orderentry.model.OrderStatus;
import com.currencyexchange.orderentry.repository.OrderMongoOperations;
import com.currencyexchange.orderentry.repository.OrderRepository;

@Service
public class OrderService {

    private static final int AMOUNT_SCALE = 8;

    private final OrderRepository orderRepository;
    private final OrderMongoOperations orderMongoOperations;

    public OrderService(OrderRepository orderRepository, OrderMongoOperations orderMongoOperations) {
        this.orderRepository = orderRepository;
        this.orderMongoOperations = orderMongoOperations;
    }

    public Order createOrder(CreateOrderRequest request) {
        BigDecimal amount = normalize(request.getAmount());
        Order order = new Order(
                request.getCurrencyPair(),
                request.getSide(),
                request.getType(),
                normalize(request.getTriggerPrice()),
                amount);
        order.setRemainingAmount(amount);
        return orderRepository.save(order);
    }

    public List<Order> listOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc();
    }

    public Order getOrder(String id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }

    public Order cancelOrder(String id) {
        return orderMongoOperations.tryCancel(id)
                .orElseGet(() -> {
                    throw rejectionFor(id);
                });
    }

    public Order fillOrder(String id, BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidFillAmountException("Fill amount must be a positive number");
        }
        return orderMongoOperations.tryFill(id, normalize(amount))
                .orElseGet(() -> {
                    Order current = getOrder(id);
                    if (current.getStatus() != OrderStatus.PENDING) {
                        throw new OrderNotOpenException(id, current.getStatus().name());
                    }
                    throw new InvalidFillAmountException("Fill amount exceeds what's left on the order");
                });
    }

    public Order amendOrder(String id, BigDecimal newPrice, BigDecimal newRemainingAmount) {
        if (newRemainingAmount != null && newRemainingAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidAmendException("Remaining amount must be greater than zero");
        }
        BigDecimal normalizedPrice = newPrice != null ? normalize(newPrice) : null;
        BigDecimal normalizedRemaining = newRemainingAmount != null ? normalize(newRemainingAmount) : null;

        return orderMongoOperations.tryAmend(id, normalizedPrice, normalizedRemaining)
                .orElseGet(() -> {
                    Order current = getOrder(id);
                    if (current.getStatus() != OrderStatus.PENDING) {
                        throw new OrderNotOpenException(id, current.getStatus().name());
                    }
                    BigDecimal effectiveRemaining = current.getRemainingAmount() != null
                            ? current.getRemainingAmount() : current.getAmount();
                    throw new InvalidAmendException(
                            "Remaining amount must be greater than zero and at most " + effectiveRemaining.stripTrailingZeros().toPlainString());
                });
    }

    private RuntimeException rejectionFor(String id) {
        Optional<Order> current = orderRepository.findById(id);
        if (current.isEmpty()) {
            return new OrderNotFoundException(id);
        }
        return new OrderNotOpenException(id, current.get().getStatus().name());
    }

    private static BigDecimal normalize(BigDecimal value) {
        return value.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
    }
}
