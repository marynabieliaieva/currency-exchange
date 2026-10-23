import { describe, it, expect } from "vitest";
import type { Order } from "../types/order";
import { summarizeOrders } from "./orderSummary";

let seq = 0;
function makeOrder(overrides: Partial<Order> = {}): Order {
  seq += 1;
  return {
    id: `o-${seq}`,
    currencyPair: "EUR/USD",
    side: "BUY",
    type: "TAKE_PROFIT",
    triggerPrice: 1.1,
    amount: 100,
    remainingAmount: 100,
    status: "PENDING",
    fillEvents: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function expectStatusSumsToTotal(orders: Order[]) {
  const r = summarizeOrders(orders);
  expect(r.byStatus.PENDING + r.byStatus.CANCELLED + r.byStatus.FILLED).toBe(r.total);
}

function pendingSum(...amounts: number[]): number {
  const orders = amounts.map((a) => makeOrder({ remainingAmount: a }));
  return summarizeOrders(orders).openAmountByPair["EUR/USD"];
}

function deepFreeze(orders: Order[]) {
  for (const o of orders) {
    for (const f of o.fillEvents) Object.freeze(f);
    Object.freeze(o.fillEvents);
    Object.freeze(o);
  }
  Object.freeze(orders);
}

describe("summarizeOrders", () => {
  it("returns the documented shape as a plain object (AC-1)", () => {
    const orders: Order[] = [makeOrder()];
    const r = summarizeOrders(orders);
    expect(Object.keys(r).sort()).toEqual(["byStatus", "openAmountByPair", "total"]);
    expect(r.openAmountByPair instanceof Map).toBe(false);
    expect(Object.getPrototypeOf(r.openAmountByPair)).toBe(Object.prototype);
  });

  it("counts total including duplicates (AC-2)", () => {
    const one = [makeOrder()];
    const dup = makeOrder();
    const five = [
      makeOrder({ status: "PENDING" }),
      makeOrder({ status: "CANCELLED" }),
      makeOrder({ status: "FILLED" }),
      makeOrder({ status: "PENDING" }),
      makeOrder({ status: "FILLED" }),
    ];
    expect(summarizeOrders(one).total).toBe(1);
    expect(summarizeOrders(five).total).toBe(5);
    expect(summarizeOrders([dup, dup]).total).toBe(2);
    [one, five, [dup, dup]].forEach(expectStatusSumsToTotal);
  });

  it("splits counts by status (AC-3)", () => {
    const orders = [
      makeOrder({ status: "PENDING" }),
      makeOrder({ status: "PENDING" }),
      makeOrder({ status: "CANCELLED" }),
      makeOrder({ status: "FILLED" }),
      makeOrder({ status: "FILLED" }),
      makeOrder({ status: "FILLED" }),
    ];
    expect(summarizeOrders(orders).byStatus).toEqual({ PENDING: 2, CANCELLED: 1, FILLED: 3 });
    expectStatusSumsToTotal(orders);
  });

  it("keeps absent statuses as zero keys (AC-4)", () => {
    const orders = [makeOrder({ status: "FILLED" }), makeOrder({ status: "FILLED" })];
    const { byStatus } = summarizeOrders(orders);
    expect(byStatus.PENDING).toBe(0);
    expect(byStatus.CANCELLED).toBe(0);
    expect("PENDING" in byStatus).toBe(true);
    expect("CANCELLED" in byStatus).toBe(true);
    expectStatusSumsToTotal(orders);
  });

  it("sums PENDING remainingAmount per pair (AC-6)", () => {
    const orders = [
      makeOrder({ currencyPair: "EUR/USD", remainingAmount: 100 }),
      makeOrder({ currencyPair: "EUR/USD", remainingAmount: 250 }),
      makeOrder({ currencyPair: "GBP/USD", remainingAmount: 40 }),
    ];
    expect(summarizeOrders(orders).openAmountByPair).toEqual({ "EUR/USD": 350, "GBP/USD": 40 });
  });

  it("yields exactly one key for a single PENDING order (EC-5)", () => {
    const r = summarizeOrders([makeOrder({ currencyPair: "USD/CHF", remainingAmount: 7 })]);
    expect(Object.keys(r.openAmountByPair)).toEqual(["USD/CHF"]);
  });

  it("uses remainingAmount, not amount, for partially filled orders (EC-6)", () => {
    const r = summarizeOrders([makeOrder({ amount: 1000, remainingAmount: 400 })]);
    expect(r.openAmountByPair["EUR/USD"]).toBe(400);
  });

  it("treats pair keys case-sensitively (EC-10)", () => {
    const r = summarizeOrders([
      makeOrder({ currencyPair: "eur/usd", remainingAmount: 1 }),
      makeOrder({ currencyPair: "EUR/USD", remainingAmount: 2 }),
    ]);
    expect(r.openAmountByPair).toEqual({ "eur/usd": 1, "EUR/USD": 2 });
  });

  it("excludes CANCELLED and FILLED orders from open amounts (AC-7)", () => {
    const r = summarizeOrders([
      makeOrder({ status: "CANCELLED", remainingAmount: 500 }),
      makeOrder({ status: "FILLED", remainingAmount: 300 }),
      makeOrder({ status: "PENDING", remainingAmount: 100 }),
    ]);
    expect(r.openAmountByPair["EUR/USD"]).toBe(100);
  });

  it("omits pairs with no PENDING orders (AC-8)", () => {
    const r = summarizeOrders([
      makeOrder({ currencyPair: "USD/JPY", status: "CANCELLED" }),
      makeOrder({ currencyPair: "USD/JPY", status: "FILLED" }),
    ]);
    expect("USD/JPY" in r.openAmountByPair).toBe(false);
  });

  it("handles an empty array (AC-9)", () => {
    const r = summarizeOrders([]);
    expect(r).toEqual({
      total: 0,
      byStatus: { PENDING: 0, CANCELLED: 0, FILLED: 0 },
      openAmountByPair: {},
    });
    expect(Object.keys(r.openAmountByPair).length).toBe(0);
    expectStatusSumsToTotal([]);
  });

  it("does not mutate a deeply frozen input (AC-10)", () => {
    const orders = [
      makeOrder({
        status: "FILLED",
        fillEvents: [{ amount: 50, timestamp: "2026-01-02T00:00:00Z" }],
      }),
      makeOrder({
        status: "PENDING",
        remainingAmount: 60,
        fillEvents: [{ amount: 40, timestamp: "2026-01-03T00:00:00Z" }],
      }),
      makeOrder({ status: "CANCELLED" }),
    ];
    const clone = structuredClone(orders);
    const refs = [...orders];
    deepFreeze(orders);
    expect(() => summarizeOrders(orders)).not.toThrow();
    expect(orders).toEqual(clone);
    expect(orders.length).toBe(refs.length);
    refs.forEach((o, i) => expect(orders[i]).toBe(o));
  });

  it("is deterministic and returns fresh objects (AC-11)", () => {
    const orders = [makeOrder({ remainingAmount: 5 }), makeOrder({ status: "FILLED" })];
    const first = summarizeOrders(orders);
    const second = summarizeOrders(orders);
    expect(first).toEqual(second);
    expect(first.byStatus).not.toBe(second.byStatus);
    expect(first.openAmountByPair).not.toBe(second.openAmountByPair);
    first.byStatus.PENDING = 99;
    first.openAmountByPair["EUR/USD"] = 99;
    expect(second.byStatus.PENDING).toBe(1);
    expect(second.openAmountByPair["EUR/USD"]).toBe(5);
    expect(orders[0].remainingAmount).toBe(5);
    expect(summarizeOrders(orders)).toEqual(second);
  });

  describe("rounding of pair totals to 8 decimals, half-up (AC-15)", () => {
    it.each([
      ["0.1 + 0.2", [0.1, 0.2], 0.3],
      ["9th decimal 5, single (0.000000015)", [0.000000015], 0.00000002],
      ["9th decimal 5, with integer part", [1.234567885], 1.23456789],
      ["9th decimal 5 reached by sum", [0.000000005, 0.00000001], 0.00000002],
      ["9th decimal 4, small", [0.000000014], 0.00000001],
      ["9th decimal 4, with integer part", [1.234567884], 1.23456788],
      ["smallest unit stays exact", [0.00000001], 0.00000001],
      ["total rounded, not addends", [0.000000004, 0.000000004], 0.00000001],
      ["integer sum unchanged", [100, 250], 350],
    ])("%s", (_name, amounts, expected) => {
      expect(pendingSum(...amounts)).toBe(expected);
    });
  });

  it("stores a __proto__ pair as an own key without touching the prototype (AC-16)", () => {
    const before = Object.getOwnPropertyNames(Object.prototype);
    const r = summarizeOrders([makeOrder({ currencyPair: "__proto__", remainingAmount: 10 })]);
    expect(Object.prototype.hasOwnProperty.call(r.openAmountByPair, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(r.openAmountByPair, "__proto__")?.value).toBe(10);
    expect(Object.keys(r.openAmountByPair)).toContain("__proto__");
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before);
    expect(Object.prototype.hasOwnProperty.call({}, "__proto__")).toBe(false);
  });
});
