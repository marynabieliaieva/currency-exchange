import { useState } from "react";
import { fillOrder } from "../api/orderApi";
import type { Order } from "../types/order";

interface FillDialogProps {
  order: Order;
  onFilled: (order: Order) => void;
  onDismiss: () => void;
  onRejected?: () => void;
}

export function FillDialog({ order, onFilled, onDismiss, onRejected }: FillDialogProps) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecord() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await fillOrder(order.id, Number(amount));
      onFilled(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record fill");
      onRejected?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog" role="dialog" aria-label="Record fill" data-testid="fill-dialog">
        <p>
          {order.currencyPair} {order.side} — remaining: {order.remainingAmount}
        </p>
        <label>
          Fill amount
          <input
            type="number"
            step="0.00000001"
            min="0"
            value={amount}
            disabled={submitting}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="fill-dialog-amount"
          />
        </label>
        {error && (
          <p className="form-error" data-testid="fill-dialog-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onDismiss} disabled={submitting} data-testid="fill-dialog-dismiss">
            Cancel
          </button>
          <button type="button" onClick={handleRecord} disabled={submitting} data-testid="fill-dialog-record">
            {submitting ? "Recording..." : "Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
