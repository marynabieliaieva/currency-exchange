import { useEffect, useState } from "react";
import { listOrders } from "../api/orderApi";
import { AmendDialog } from "../components/AmendDialog";
import { CancelDialog } from "../components/CancelDialog";
import { CancelForfeitureDialog } from "../components/CancelForfeitureDialog";
import { FillDialog } from "../components/FillDialog";
import { ManageOrdersList } from "../components/ManageOrdersList";
import type { Order } from "../types/order";

type DialogState = { kind: "cancel" | "cancel-forfeiture" | "fill" | "amend"; order: Order } | null;

export function ManageOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

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
    setDialog({ kind: order.fillEvents.length > 0 ? "cancel-forfeiture" : "cancel", order });
  }

  function handleFill(order: Order) {
    setDialog({ kind: "fill", order });
  }

  function handleAmend(order: Order) {
    setDialog({ kind: "amend", order });
  }

  function handleOrderUpdated(updated: Order) {
    setOrders((current) => current?.map((o) => (o.id === updated.id ? updated : o)) ?? current);
    setDialog(null);
  }

  return (
    <div className="page">
      <h1>Manage Orders</h1>
      {error && <p className="form-error">{error}</p>}
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
        />
      )}
      {dialog?.kind === "cancel-forfeiture" && (
        <CancelForfeitureDialog
          order={dialog.order}
          onCancelled={handleOrderUpdated}
          onDismiss={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "fill" && (
        <FillDialog
          order={dialog.order}
          onFilled={handleOrderUpdated}
          onDismiss={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "amend" && (
        <AmendDialog
          order={dialog.order}
          onAmended={handleOrderUpdated}
          onDismiss={() => setDialog(null)}
        />
      )}
    </div>
  );
}
