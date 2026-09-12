import { Fragment, useState } from "react";
import type { Order } from "../types/order";

interface ManageOrdersListProps {
  orders: Order[];
  onCancel: (order: Order) => void;
  onFill: (order: Order) => void;
  onAmend: (order: Order) => void;
}

const ORDER_TYPE_LABELS: Record<Order["type"], string> = {
  TAKE_PROFIT: "Take Profit",
  STOP_LOSS: "Stop Loss",
};

export function ManageOrdersList({ orders, onCancel, onFill, onAmend }: ManageOrdersListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (orders.length === 0) {
    return <p>No orders yet.</p>;
  }

  return (
    <table className="order-list">
      <thead>
        <tr>
          <th></th>
          <th>Pair</th>
          <th>Side</th>
          <th>Type</th>
          <th>Trigger Price</th>
          <th>Amount</th>
          <th>Remaining</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => {
          const isPending = order.status === "PENDING";
          const hasFills = order.fillEvents.length > 0;
          const isExpanded = expandedId === order.id;
          return (
            <Fragment key={order.id}>
              <tr>
                <td>
                  {hasFills && (
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse fill trail" : "Expand fill trail"}
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  )}
                </td>
                <td>{order.currencyPair}</td>
                <td>{order.side}</td>
                <td>{ORDER_TYPE_LABELS[order.type]}</td>
                <td>{order.triggerPrice}</td>
                <td>{order.amount}</td>
                <td>{order.remainingAmount}</td>
                <td>{order.status}</td>
                <td>
                  <button type="button" disabled={!isPending} onClick={() => onCancel(order)}>
                    Cancel
                  </button>
                  <button type="button" disabled={!isPending} onClick={() => onFill(order)}>
                    Fill
                  </button>
                  <button type="button" disabled={!isPending} onClick={() => onAmend(order)}>
                    Amend
                  </button>
                </td>
              </tr>
              {isExpanded && (
                <tr>
                  <td></td>
                  <td colSpan={8}>{order.fillEvents.length} fill(s) recorded</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
