import { useState } from "react";
import type { CreateOrderRequest, OrderSide, OrderType } from "../types/order";

const CURRENCY_PAIR_PATTERN = /^[A-Z]{3}\/[A-Z]{3}$/;

interface OrderEntryFormProps {
  onSubmit: (request: CreateOrderRequest) => Promise<void>;
}

export function OrderEntryForm({ onSubmit }: OrderEntryFormProps) {
  const [currencyPair, setCurrencyPair] = useState("EUR/USD");
  const [side, setSide] = useState<OrderSide>("BUY");
  const [type, setType] = useState<OrderType>("TAKE_PROFIT");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (!CURRENCY_PAIR_PATTERN.test(currencyPair)) {
      return "Currency pair must look like EUR/USD";
    }
    if (!triggerPrice || Number(triggerPrice) <= 0) {
      return "Trigger price must be greater than 0";
    }
    if (!amount || Number(amount) <= 0) {
      return "Amount must be greater than 0";
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        currencyPair,
        side,
        type,
        triggerPrice: Number(triggerPrice),
        amount: Number(amount),
      });
      setTriggerPrice("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="order-entry-form" onSubmit={handleSubmit} data-testid="order-entry-form">
      <h2>New Order</h2>

      <label>
        Currency Pair
        <input
          value={currencyPair}
          onChange={(e) => setCurrencyPair(e.target.value.toUpperCase())}
          placeholder="EUR/USD"
          data-testid="order-entry-currency-pair"
        />
      </label>

      <label>
        Side
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as OrderSide)}
          data-testid="order-entry-side"
        >
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
      </label>

      <label>
        Order Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as OrderType)}
          data-testid="order-entry-type"
        >
          <option value="TAKE_PROFIT">Take Profit</option>
          <option value="STOP_LOSS">Stop Loss</option>
        </select>
      </label>

      <label>
        Trigger Price
        <input
          type="number"
          step="0.0001"
          min="0"
          value={triggerPrice}
          onChange={(e) => setTriggerPrice(e.target.value)}
          data-testid="order-entry-trigger-price"
        />
      </label>

      <label>
        Amount
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="order-entry-amount"
        />
      </label>

      {error && (
        <p className="form-error" data-testid="order-entry-error">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} data-testid="order-entry-submit">
        {submitting ? "Submitting..." : "Submit Order"}
      </button>
    </form>
  );
}
