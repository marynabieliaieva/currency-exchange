import { useState } from "react";
import { cancelOrder } from "../api/orderApi";
import type { Order } from "../types/order";

interface CancelDialogProps {
  order: Order;
  onCancelled: (order: Order) => void;
  onDismiss: () => void;
}

export function CancelDialog({ order, onCancelled, onDismiss }: CancelDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const cancelled = await cancelOrder(order.id);
      onCancelled(cancelled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog" role="dialog" aria-label="Cancel order">
        <p>Cancel this {order.currencyPair} order?</p>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onDismiss} disabled={submitting}>
            Dismiss
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Cancelling..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
