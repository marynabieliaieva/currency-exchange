import { Link, Route, Routes } from "react-router-dom";
import { ManageOrdersPage } from "./pages/ManageOrdersPage";
import { OrderEntryPage } from "./pages/OrderEntryPage";

export function AppRoutes() {
  return (
    <>
      <nav className="app-nav">
        <Link to="/">Order Entry</Link>
        <Link to="/manage-orders">Manage Orders</Link>
      </nav>
      <Routes>
        <Route path="/" element={<OrderEntryPage />} />
        <Route path="/manage-orders" element={<ManageOrdersPage />} />
        <Route path="*" element={<OrderEntryPage />} />
      </Routes>
    </>
  );
}
