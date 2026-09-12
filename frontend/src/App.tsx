import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { ManageOrdersPage } from "./pages/ManageOrdersPage";
import { OrderEntryPage } from "./pages/OrderEntryPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <nav className="app-nav">
        <Link to="/">Order Entry</Link>
        <Link to="/manage-orders">Manage Orders</Link>
      </nav>
      <Routes>
        <Route path="/" element={<OrderEntryPage />} />
        <Route path="/manage-orders" element={<ManageOrdersPage />} />
        <Route path="*" element={<OrderEntryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
