import { useEffect, useState } from "react";
import { listOrders } from "../api/orderApi";
import { AmendDialog } from "../components/AmendDialog";
import { CancelDialog } from "../components/CancelDialog";
import { CancelForfeitureDialog } from "../components/CancelForfeitureDialog";
import { FillDialog } from "../components/FillDialog";
import { ManageOrdersList } from "../components/ManageOrdersList";
import type { Order } from "../types/order";

type DialogKind = "cancel" | "cancel-forfeiture" | "fill" | "amend";
type DialogState = { kind: DialogKind; order: Order } | null;

function confirmationMessageFor(kind: DialogKind | undefined, updated: Order): string {
  switch (kind) {
    case "cancel":
    case "cancel-forfeiture":
      return `Order cancelled: ${updated.currencyPair} ${updated.side} ${updated.amount}`;
    case "fill":
      return `Fill recorded: ${updated.currencyPair} ${updated.side} — remaining ${updated.remainingAmount}`;
    case "amend":
      return `Order amended: ${updated.currencyPair} ${updated.side} — trigger ${updated.triggerPrice}, remaining ${updated.remainingAmount}`;
    default:
      return "Order updated";
  }
}

export function ManageOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function refreshOrders() {
    try {
      const fetched = await listOrders();
      setOrders(fetched);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    }
  }

  useEffect(() => {
    refreshOrders();
  }, []);

  function handleCancel(order: Order) {
    setConfirmation(null);
    setDialog({ kind: order.fillEvents.length > 0 ? "cancel-forfeiture" : "cancel", order });
  }

  function handleFill(order: Order) {
    setConfirmation(null);
    setDialog({ kind: "fill", order });
  }

  function handleAmend(order: Order) {
    setConfirmation(null);
    setDialog({ kind: "amend", order });
  }

  function handleOrderUpdated(updated: Order) {
    setOrders((current) => current?.map((o) => (o.id === updated.id ? updated : o)) ?? current);
    setConfirmation(confirmationMessageFor(dialog?.kind, updated));
    setDialog(null);
  }

  return (
    <div className="page">
      <h1>Manage Orders</h1>
      {error && <p className="form-error">{error}</p>}
      {!error && confirmation && <p className="inline-status inline-status-success">{confirmation}</p>}
      {!error && orders === null && <p>Loading orders...</p>}
      {!error && orders !== null && (
        <ManageOrdersList
          orders={orders}
          onCancel={handleCancel}
          onFill={handleFill}
          onAmend={handleAmend}
        />
      )}
      {dialog?.kind === "cancel" && (
        <CancelDialog
          order={dialog.order}
          onCancelled={handleOrderUpdated}
          onDismiss={() => setDialog(null)}
          onRejected={refreshOrders}
        />
      )}
      {dialog?.kind === "cancel-forfeiture" && (
        <CancelForfeitureDialog
          order={dialog.order}
          onCancelled={handleOrderUpdated}
          onDismiss={() => setDialog(null)}
          onRejected={refreshOrders}
        />
      )}
      {dialog?.kind === "fill" && (
        <FillDialog
          order={dialog.order}
          onFilled={handleOrderUpdated}
          onDismiss={() => setDialog(null)}
          onRejected={refreshOrders}
        />
      )}
      {dialog?.kind === "amend" && (
        <AmendDialog
          order={dialog.order}
          onAmended={handleOrderUpdated}
          onDismiss={() => setDialog(null)}
          onRejected={refreshOrders}
        />
      )}
    </div>
  );
}
