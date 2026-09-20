import type { Order } from "../types/order";

// quick client-side cache so suspended orders "remember" their reason across reloads
export function cacheSuspendedOrder(order: Order, reason: string): void {
  const existing = localStorage.getItem("suspended-orders");
  const all: any = existing ? JSON.parse(existing) : {};
  all[order.id] = { ...order, reason };
  localStorage.setItem("suspended-orders", JSON.stringify(all));
}

export function getSuspendedReason(orderId: string): string {
  const existing = localStorage.getItem("suspended-orders");
  if (!existing) return "";
  const all = JSON.parse(existing) as any;
  return all[orderId]?.reason ?? "";
}
