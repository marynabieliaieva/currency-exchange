import type { Order } from "../types/order";

interface OrderListProps {
  orders: Order[];
  onCancel: (id: string) => void;
}

const ORDER_TYPE_LABELS: Record<Order["type"], string> = {
  TAKE_PROFIT: "Take Profit",
  STOP_LOSS: "Stop Loss",
};

export function OrderList({ orders, onCancel }: OrderListProps) {
  if (orders.length === 0) {
    return <p>No orders yet.</p>;
  }

  return (
    <table className="order-list">
      <thead>
        <tr>
          <th>Pair</th>
          <th>Side</th>
          <th>Type</th>
          <th>Trigger Price</th>
          <th>Amount</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>{order.currencyPair}</td>
            <td>{order.side}</td>
            <td>{ORDER_TYPE_LABELS[order.type]}</td>
            <td>{order.triggerPrice}</td>
            <td>{order.amount}</td>
            <td>{order.status}</td>
            <td>
              <button
                type="button"
                disabled={order.status === "CANCELLED"}
                onClick={() => onCancel(order.id)}
              >
                Cancel
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
