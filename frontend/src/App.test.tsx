import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManageOrdersPage } from "./pages/ManageOrdersPage";
import { OrderEntryPage } from "./pages/OrderEntryPage";
import * as orderApi from "./api/orderApi";

vi.mock("./api/orderApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/orderApi")>();
  return { ...actual, listOrders: vi.fn() };
});

function Nav() {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <nav className="app-nav">
        <Link to="/">Order Entry</Link>
        <Link to="/manage-orders">Manage Orders</Link>
      </nav>
      <Routes>
        <Route path="/" element={<OrderEntryPage />} />
        <Route path="/manage-orders" element={<ManageOrdersPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("App routing — AC-15 each screen reachable at its own distinct address", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders the order entry page at /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<OrderEntryPage />} />
          <Route path="/manage-orders" element={<ManageOrdersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /New Order/i })).toBeInTheDocument();
  });

  it("renders the manage orders page at /manage-orders", async () => {
    vi.mocked(orderApi.listOrders).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/manage-orders"]}>
        <Routes>
          <Route path="/" element={<OrderEntryPage />} />
          <Route path="/manage-orders" element={<ManageOrdersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Manage Orders/i })).toBeInTheDocument();
  });

  it("switches between screens via the nav links", async () => {
    vi.mocked(orderApi.listOrders).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<Nav />);

    expect(screen.getByRole("heading", { name: /New Order/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Manage Orders/i }));
    expect(await screen.findByRole("heading", { name: /Manage Orders/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Order Entry/i }));
    expect(await screen.findByRole("heading", { name: /New Order/i })).toBeInTheDocument();
  });
});
