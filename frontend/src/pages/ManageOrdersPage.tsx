import { useEffect, useState } from "react";
import { listOrders } from "../api/orderApi";
import { ManageOrdersList } from "../components/ManageOrdersList";
import type { Order } from "../types/order";

export function ManageOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    void order;
  }

  function handleFill(order: Order) {
    void order;
  }

  function handleAmend(order: Order) {
    void order;
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
    </div>
  );
}
