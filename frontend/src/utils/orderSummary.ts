import type { Order, OrderStatus } from "../types/order";

export type OrderSummary = {
  total: number;
  byStatus: Record<OrderStatus, number>;
  openAmountByPair: Record<string, number>;
};

// Collapse float noise to 15 significant digits before and after the shift so
// that half-up rounding on the 9th decimal is correct (naive Math.round(x * 1e8)
// and toFixed(8) misround values such as 0.000000015).
function roundTo8(value: number): number {
  const cleaned = Number(value.toPrecision(15));
  const shifted = Number((cleaned * 1e8).toPrecision(15));
  return Math.round(shifted) / 1e8;
}

export function summarizeOrders(orders: readonly Order[]): OrderSummary {
  const byStatus: Record<OrderStatus, number> = {
    PENDING: 0,
    CANCELLED: 0,
    FILLED: 0,
  };
  const openByPair = new Map<string, number>();

  for (const o of orders) {
    byStatus[o.status] += 1;
    if (o.status === "PENDING") {
      openByPair.set(o.currencyPair, (openByPair.get(o.currencyPair) ?? 0) + o.remainingAmount);
    }
  }

  // defineProperty keeps "__proto__" an own data property on a normal object.
  const openAmountByPair: Record<string, number> = {};
  for (const [pair, sum] of openByPair) {
    Object.defineProperty(openAmountByPair, pair, {
      value: roundTo8(sum),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return { total: orders.length, byStatus, openAmountByPair };
}
