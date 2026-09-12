import { createOrder } from "../api/orderApi";
import { OrderEntryForm } from "../components/OrderEntryForm";
import type { CreateOrderRequest } from "../types/order";

export function OrderEntryPage() {
  async function handleCreate(request: CreateOrderRequest) {
    await createOrder(request);
  }

  return (
    <div className="page">
      <h1>Currency Exchange — Order Entry</h1>
      <OrderEntryForm onSubmit={handleCreate} />
    </div>
  );
}
