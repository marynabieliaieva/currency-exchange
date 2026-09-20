import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderEntryPage } from "./OrderEntryPage";
import * as orderApi from "../api/orderApi";
import type { Order } from "../types/order";

vi.mock("../api/orderApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/orderApi")>();
  return { ...actual, createOrder: vi.fn() };
});

const mockedCreateOrder = vi.mocked(orderApi.createOrder);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
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

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Trigger Price/i), "1.25");
  await user.type(screen.getByLabelText(/Amount/i), "50");
  await user.click(screen.getByRole("button", { name: /Submit Order/i }));
  return user;
}

describe("OrderEntryPage — AC-09 creation-only page", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("shows only the order creation form — no list, no Cancel action", () => {
    render(<OrderEntryPage />);

    expect(screen.getByRole("heading", { name: /New Order/i })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it("confirms creation with a success banner", async () => {
    mockedCreateOrder.mockResolvedValue(makeOrder());

    render(<OrderEntryPage />);
    await fillAndSubmit();

    expect(await screen.findByText(/Order created: EUR\/USD BUY 100/i)).toBeInTheDocument();
  });
});
