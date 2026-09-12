import { useState } from "react";
import { amendOrder } from "../api/orderApi";
import type { Order } from "../types/order";

interface AmendDialogProps {
  order: Order;
  onAmended: (order: Order) => void;
  onDismiss: () => void;
  onRejected?: () => void;
}

function sumFilled(order: Order): number {
  return order.fillEvents.reduce((total, fill) => total + fill.amount, 0);
}

export function AmendDialog({ order, onAmended, onDismiss, onRejected }: AmendDialogProps) {
  const [triggerPrice, setTriggerPrice] = useState(String(order.triggerPrice));
  const [remainingAmount, setRemainingAmount] = useState(String(order.remainingAmount ?? order.amount));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyFilled = sumFilled(order);

  async function handleAmend() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await amendOrder(order.id, {
        triggerPrice: Number(triggerPrice),
        remainingAmount: Number(remainingAmount),
      });
      onAmended(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to amend order");
      onRejected?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog" role="dialog" aria-label="Amend order">
        <p>
          {order.currencyPair} {order.side} — filled so far: {alreadyFilled}
        </p>
        <label>
          Trigger price
          <input
            type="number"
            step="0.00000001"
            min="0"
            value={triggerPrice}
            disabled={submitting}
            onChange={(e) => setTriggerPrice(e.target.value)}
          />
        </label>
        <label>
          Remaining amount
          <input
            type="number"
            step="0.00000001"
            min="0"
            value={remainingAmount}
            disabled={submitting}
            onChange={(e) => setRemainingAmount(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onDismiss} disabled={submitting}>
            Cancel
          </button>
          <button type="button" onClick={handleAmend} disabled={submitting}>
            {submitting ? "Amending..." : "Amend"}
          </button>
        </div>
      </div>
    </div>
  );
}
