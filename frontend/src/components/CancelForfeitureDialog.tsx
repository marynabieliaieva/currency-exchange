import { useState } from "react";
import { cancelOrder } from "../api/orderApi";
import type { Order } from "../types/order";

interface CancelForfeitureDialogProps {
  order: Order;
  onCancelled: (order: Order) => void;
  onDismiss: () => void;
}

function sumFilled(order: Order): number {
  return order.fillEvents.reduce((total, fill) => total + fill.amount, 0);
}

export function CancelForfeitureDialog({ order, onCancelled, onDismiss }: CancelForfeitureDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedForfeiture, setConfirmedForfeiture] = useState(false);

  const alreadyFilled = sumFilled(order);
  const remaining = order.remainingAmount;

  async function handleConfirm() {
    if (!confirmedForfeiture) {
      setConfirmedForfeiture(true);
      return;
    }
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
      <div className="dialog" role="dialog" aria-label="Cancel order with forfeiture">
        <p>
          Already filled: {alreadyFilled}. Cancelling this {order.currencyPair} order permanently
          forfeits the remaining {remaining}.
        </p>
        {confirmedForfeiture && (
          <p className="form-error">
            This cannot be undone — the remaining {remaining} will be permanently forfeited.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onDismiss} disabled={submitting}>
            Dismiss
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting
              ? "Cancelling..."
              : confirmedForfeiture
                ? "Confirm forfeiture"
                : "Cancel order"}
          </button>
        </div>
      </div>
    </div>
  );
}
