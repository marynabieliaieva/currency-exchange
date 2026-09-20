import { useState } from "react";
import { createOrder } from "../api/orderApi";
import { OrderEntryForm } from "../components/OrderEntryForm";
import type { CreateOrderRequest } from "../types/order";

export function OrderEntryPage() {
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function handleCreate(request: CreateOrderRequest) {
    const created = await createOrder(request);
    setConfirmation(`Order created: ${created.currencyPair} ${created.side} ${created.amount}`);
  }

  return (
    <div className="page">
      <h1>Currency Exchange — Order Entry</h1>
      {confirmation && <p className="inline-status inline-status-success">{confirmation}</p>}
      <OrderEntryForm onSubmit={handleCreate} />
    </div>
  );
}
