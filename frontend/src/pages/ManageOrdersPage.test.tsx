import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManageOrdersPage } from "./ManageOrdersPage";
import * as orderApi from "../api/orderApi";
import { ApiRequestError } from "../api/orderApi";
import type { Order } from "../types/order";

vi.mock("../api/orderApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/orderApi")>();
  return {
    ...actual,
    listOrders: vi.fn(),
    cancelOrder: vi.fn(),
    fillOrder: vi.fn(),
    amendOrder: vi.fn(),
  };
});

const mockedListOrders = vi.mocked(orderApi.listOrders);
const mockedCancelOrder = vi.mocked(orderApi.cancelOrder);
const mockedFillOrder = vi.mocked(orderApi.fillOrder);
const mockedAmendOrder = vi.mocked(orderApi.amendOrder);

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

function rowFor(name: RegExp) {
  return screen.getByRole("row", { name });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("ManageOrdersPage — AC-14 mixed-status list", () => {
  it("lists orders of every status, gating Cancel/Fill/Amend to PENDING only", async () => {
    mockedListOrders.mockResolvedValue([
      makeOrder({ id: "p1", status: "PENDING" }),
      makeOrder({ id: "c1", status: "CANCELLED", currencyPair: "GBP/USD" }),
      makeOrder({ id: "f1", status: "FILLED", currencyPair: "USD/JPY", remainingAmount: 0 }),
    ]);

    render(<ManageOrdersPage />);

    const pendingRow = await screen.findByRole("row", { name: /EUR\/USD/i });
    const cancelledRow = screen.getByRole("row", { name: /GBP\/USD/i });
    const filledRow = screen.getByRole("row", { name: /USD\/JPY/i });

    for (const label of ["Cancel", "Fill", "Amend"]) {
      expect(within(pendingRow).getByRole("button", { name: label })).toBeEnabled();
      expect(within(cancelledRow).getByRole("button", { name: label })).toBeDisabled();
      expect(within(filledRow).getByRole("button", { name: label })).toBeDisabled();
    }
  });
});

describe("ManageOrdersPage — AC-01 cancel with no fills", () => {
  it("marks a fill-less PENDING order CANCELLED and confirms", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([makeOrder()]);
    mockedCancelOrder.mockResolvedValue(makeOrder({ status: "CANCELLED" }));

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", { name: /Cancel order/i });
    await user.click(within(dialog).getByRole("button", { name: /Confirm/i }));

    expect(mockedCancelOrder).toHaveBeenCalledWith("order-1");
    expect(await screen.findByRole("row", { name: /CANCELLED/i })).toBeInTheDocument();
    expect(screen.getByText(/Order cancelled/i)).toBeInTheDocument();
  });
});

describe("ManageOrdersPage — AC-02 cancel with forfeiture", () => {
  it("requires a second confirmation naming the forfeited remainder, then cancels leaving remaining unchanged", async () => {
    const user = userEvent.setup();
    const withFills = makeOrder({
      remainingAmount: 60,
      fillEvents: [{ amount: 40, timestamp: "2026-01-01T00:00:00Z" }],
    });
    mockedListOrders.mockResolvedValue([withFills]);
    mockedCancelOrder.mockResolvedValue({ ...withFills, status: "CANCELLED" });

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", { name: /Cancel order with forfeiture/i });
    expect(within(dialog).getByText(/Already filled: 40/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/permanently\s+forfeits the remaining 60/i)).toBeInTheDocument();

    expect(mockedCancelOrder).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: /Cancel order/i }));
    expect(mockedCancelOrder).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /Confirm forfeiture/i }));

    expect(mockedCancelOrder).toHaveBeenCalledWith("order-1");
    const cancelledRow = await screen.findByRole("row", { name: /CANCELLED/i });
    expect(within(cancelledRow).getByText("60")).toBeInTheDocument();
    expect(screen.getByText(/Order cancelled/i)).toBeInTheDocument();
  });
});

describe("ManageOrdersPage — AC-03/AC-04 fill", () => {
  it("records a fill within the remaining amount, marking the order FILLED when remaining reaches zero", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([makeOrder({ remainingAmount: 100 })]);
    mockedFillOrder.mockResolvedValue(
      makeOrder({
        remainingAmount: 0,
        status: "FILLED",
        fillEvents: [{ amount: 100, timestamp: "2026-01-01T01:00:00Z" }],
      }),
    );

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Fill" }));
    const dialog = await screen.findByRole("dialog", { name: /Record fill/i });
    await user.type(within(dialog).getByLabelText(/Fill amount/i), "100");
    await user.click(within(dialog).getByRole("button", { name: /Record/i }));

    expect(mockedFillOrder).toHaveBeenCalledWith("order-1", 100);
    expect(await screen.findByRole("row", { name: /FILLED/i })).toBeInTheDocument();
    expect(screen.getByText(/Fill recorded/i)).toBeInTheDocument();
  });

  it("rejects a fill that exceeds the remaining amount and leaves the remaining amount unchanged", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([makeOrder({ remainingAmount: 50 })]);
    mockedFillOrder.mockRejectedValue(
      new ApiRequestError("Fill exceeds remaining amount", 409, "order.fill_exceeds_remaining"),
    );

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Fill" }));
    const dialog = await screen.findByRole("dialog", { name: /Record fill/i });
    await user.type(within(dialog).getByLabelText(/Fill amount/i), "999");
    await user.click(within(dialog).getByRole("button", { name: /Record/i }));

    expect(await within(dialog).findByText(/Fill exceeds remaining amount/i)).toBeInTheDocument();
    expect(within(rowFor(/EUR\/USD/i)).getByText("50")).toBeInTheDocument();
  });

  it("guards against a double-submitted fill by disabling Record while the request is in flight (AC-05)", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([makeOrder({ remainingAmount: 100 })]);
    mockedFillOrder.mockImplementation(() => new Promise<Order>(() => {}));

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Fill" }));
    const dialog = await screen.findByRole("dialog", { name: /Record fill/i });
    await user.type(within(dialog).getByLabelText(/Fill amount/i), "40");

    const recordButton = within(dialog).getByRole("button", { name: /Record/i });
    await user.click(recordButton);
    expect(recordButton).toBeDisabled();
    await user.click(recordButton);

    expect(mockedFillOrder).toHaveBeenCalledTimes(1);
  });
});

describe("ManageOrdersPage — AC-06/AC-07/AC-12 amend", () => {
  it("updates trigger price and remaining amount and confirms the new values", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([makeOrder()]);
    mockedAmendOrder.mockResolvedValue(makeOrder({ triggerPrice: 1.5, remainingAmount: 80 }));

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Amend" }));
    const dialog = await screen.findByRole("dialog", { name: /Amend order/i });
    const triggerInput = within(dialog).getByLabelText(/Trigger price/i);
    const remainingInput = within(dialog).getByLabelText(/Remaining amount/i);
    await user.clear(triggerInput);
    await user.type(triggerInput, "1.5");
    await user.clear(remainingInput);
    await user.type(remainingInput, "80");
    await user.click(within(dialog).getByRole("button", { name: /^Amend$/i }));

    expect(mockedAmendOrder).toHaveBeenCalledWith("order-1", { triggerPrice: 1.5, remainingAmount: 80 });
    const updatedRow = await screen.findByRole("row", { name: /EUR\/USD/i });
    expect(within(updatedRow).getByText("1.5")).toBeInTheDocument();
    expect(within(updatedRow).getByText("80")).toBeInTheDocument();
    expect(screen.getByText(/Order amended/i)).toBeInTheDocument();
  });

  it("only ever changes the remaining amount for an order with fill events, never the already-filled portion (AC-07)", async () => {
    const user = userEvent.setup();
    const withFills = makeOrder({
      remainingAmount: 60,
      fillEvents: [{ amount: 40, timestamp: "2026-01-01T00:00:00Z" }],
    });
    mockedListOrders.mockResolvedValue([withFills]);
    mockedAmendOrder.mockResolvedValue({ ...withFills, remainingAmount: 30 });

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Amend" }));
    const dialog = await screen.findByRole("dialog", { name: /Amend order/i });
    expect(within(dialog).getByText(/filled so far: 40/i)).toBeInTheDocument();

    const remainingInput = within(dialog).getByLabelText(/Remaining amount/i);
    await user.clear(remainingInput);
    await user.type(remainingInput, "30");
    await user.click(within(dialog).getByRole("button", { name: /^Amend$/i }));

    expect(mockedAmendOrder).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ remainingAmount: 30 }),
    );
    const updatedRow = await screen.findByRole("row", { name: /EUR\/USD/i });
    expect(within(updatedRow).getByText("30")).toBeInTheDocument();
  });

  it("rejects an amend above the allowed max or to exactly zero, explaining the allowed range", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([makeOrder({ remainingAmount: 100, amount: 100 })]);
    mockedAmendOrder.mockRejectedValue(
      new ApiRequestError(
        "Remaining amount must be greater than 0 and at most 100",
        409,
        "order.amend_out_of_range",
      ),
    );

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Amend" }));
    const dialog = await screen.findByRole("dialog", { name: /Amend order/i });
    const remainingInput = within(dialog).getByLabelText(/Remaining amount/i);
    await user.clear(remainingInput);
    await user.type(remainingInput, "0");
    await user.click(within(dialog).getByRole("button", { name: /^Amend$/i }));

    expect(
      await within(dialog).findByText(/Remaining amount must be greater than 0 and at most 100/i),
    ).toBeInTheDocument();
  });
});

describe("ManageOrdersPage — AC-08 fill trail", () => {
  it("shows each fill event's amount and timestamp, oldest first, on row expand", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([
      makeOrder({
        remainingAmount: 50,
        fillEvents: [
          { amount: 30, timestamp: "2026-01-01T00:00:00Z" },
          { amount: 20, timestamp: "2026-01-02T00:00:00Z" },
        ],
      }),
    ]);

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Expand fill trail" }));

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("30");
    expect(items[1]).toHaveTextContent("20");
  });
});

describe("ManageOrdersPage — AC-10/AC-13 closed-order and race-loss rejection surfaced in the UI", () => {
  it("surfaces the server's rejection when an action loses a race and the order is no longer open", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue([makeOrder({ remainingAmount: 100 })]);
    mockedFillOrder.mockRejectedValue(
      new ApiRequestError("Order is no longer open", 409, "order.not_pending"),
    );

    render(<ManageOrdersPage />);
    await screen.findByRole("row", { name: /EUR\/USD/i });

    await user.click(screen.getByRole("button", { name: "Fill" }));
    const dialog = await screen.findByRole("dialog", { name: /Record fill/i });
    await user.type(within(dialog).getByLabelText(/Fill amount/i), "10");
    await user.click(within(dialog).getByRole("button", { name: /Record/i }));

    expect(await within(dialog).findByText(/Order is no longer open/i)).toBeInTheDocument();
  });
});
