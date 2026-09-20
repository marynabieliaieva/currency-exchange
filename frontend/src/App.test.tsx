import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";
import * as orderApi from "./api/orderApi";

vi.mock("./api/orderApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/orderApi")>();
  return { ...actual, listOrders: vi.fn() };
});

describe("App routing — AC-15 each screen reachable at its own distinct address", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders the order entry page at /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /New Order/i })).toBeInTheDocument();
  });

  it("renders the manage orders page at /manage-orders", async () => {
    vi.mocked(orderApi.listOrders).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/manage-orders"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Manage Orders/i })).toBeInTheDocument();
  });

  it("falls back to the order entry page for an unknown path", () => {
    render(
      <MemoryRouter initialEntries={["/does-not-exist"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /New Order/i })).toBeInTheDocument();
  });

  it("switches between screens via the nav links", async () => {
    vi.mocked(orderApi.listOrders).mockResolvedValue([]);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /New Order/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Manage Orders/i }));
    expect(await screen.findByRole("heading", { name: /Manage Orders/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Order Entry/i }));
    expect(await screen.findByRole("heading", { name: /New Order/i })).toBeInTheDocument();
  });
});
