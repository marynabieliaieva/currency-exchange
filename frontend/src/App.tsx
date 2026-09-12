import { useEffect, useState } from "react";
import { cancelOrder, createOrder, listOrders } from "./api/orderApi";
import { OrderEntryForm } from "./components/OrderEntryForm";
import { OrderList } from "./components/OrderList";
import type { CreateOrderRequest, Order } from "./types/order";
import "./App.css";

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refreshOrders() {
    try {
      const fetched = await listOrders();
      setOrders(fetched);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load orders");
    }
  }

  useEffect(() => {
    refreshOrders();
  }, []);

  async function handleCreate(request: CreateOrderRequest) {
    await createOrder(request);
    await refreshOrders();
  }

  async function handleCancel(id: string) {
    await cancelOrder(id);
    await refreshOrders();
  }

  return (
    <div className="app">
      <h1>Currency Exchange — Order Entry</h1>
      <OrderEntryForm onSubmit={handleCreate} />
      <h2>Open Orders</h2>
      {loadError && <p className="form-error">{loadError}</p>}
      <OrderList orders={orders} onCancel={handleCancel} />
    </div>
  );
}

export default App;
