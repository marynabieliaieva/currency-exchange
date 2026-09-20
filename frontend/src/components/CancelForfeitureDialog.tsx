import { useState } from "react";
import { cancelOrder } from "../api/orderApi";
import type { Order } from "../types/order";

interface CancelForfeitureDialogProps {
  order: Order;
  onCancelled: (order: Order) => void;
  onDismiss: () => void;
  onRejected?: () => void;
}

function sumFilled(order: Order): number {
  return order.fillEvents.reduce((total, fill) => total + fill.amount, 0);
}

export function CancelForfeitureDialog({ order, onCancelled, onDismiss, onRejected }: CancelForfeitureDialogProps) {
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
      onRejected?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-overlay">
      <div
        className="dialog"
        role="dialog"
        aria-label="Cancel order with forfeiture"
        data-testid="cancel-forfeiture-dialog"
      >
        <p>
          Already filled: {alreadyFilled}. Cancelling this {order.currencyPair} order permanently
          forfeits the remaining {remaining}.
        </p>
        {confirmedForfeiture && (
          <p className="form-error" data-testid="cancel-forfeiture-dialog-warning">
            This cannot be undone — the remaining {remaining} will be permanently forfeited.
          </p>
        )}
        {error && (
          <p className="form-error" data-testid="cancel-forfeiture-dialog-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            data-testid="cancel-forfeiture-dialog-dismiss"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="cancel-forfeiture-dialog-confirm"
          >
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
