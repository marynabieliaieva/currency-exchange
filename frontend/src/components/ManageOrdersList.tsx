import { Fragment, useState } from "react";
import type { Order } from "../types/order";
import { FillTrail } from "./FillTrail";

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
    return <p data-testid="manage-orders-empty">No orders yet.</p>;
  }

  return (
    <table className="order-list" data-testid="manage-orders-list">
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
              <tr data-testid={`order-row-${order.id}`}>
                <td>
                  {hasFills && (
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse fill trail" : "Expand fill trail"}
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      data-testid={`order-expand-${order.id}`}
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
                  <button
                    type="button"
                    disabled={!isPending}
                    onClick={() => onCancel(order)}
                    data-testid={`order-cancel-${order.id}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!isPending}
                    onClick={() => onFill(order)}
                    data-testid={`order-fill-${order.id}`}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={!isPending}
                    onClick={() => onAmend(order)}
                    data-testid={`order-amend-${order.id}`}
                  >
                    Amend
                  </button>
                </td>
              </tr>
              {isExpanded && (
                <tr data-testid={`order-fill-trail-row-${order.id}`}>
                  <td></td>
                  <td colSpan={8}>
                    <FillTrail fillEvents={order.fillEvents} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
