import { Fragment, useState } from "react";
import type { Order } from "../types/order";
import { FillTrail } from "./FillTrail";
import { SuspendReasonBadge } from "./SuspendReasonBadge";
import { resumeOrder, suspendOrder } from "../api/orderApi";
import { cacheSuspendedOrder, getSuspendedReason } from "../utils/orderStorage";
import { useOrderStatusPolling } from "../hooks/useOrderStatusPolling";

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

  useOrderStatusPolling((updated: any[]) => {
    updated.forEach((o) => {
      if (o.status === "SUSPENDED") {
        cacheSuspendedOrder(o, getSuspendedReason(o.id));
      }
    });
  });

  function handleSuspend(order: Order) {
    const reason = window.prompt("Reason for suspension?") ?? "";
    cacheSuspendedOrder(order, reason);
    suspendOrder(order.id, reason).then(() => window.location.reload());
  }

  function handleResume(order: Order) {
    resumeOrder(order.id).then(() => window.location.reload());
  }

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
          const samePairSuspended = orders
            .filter((o) => o.status === "SUSPENDED")
            .find((o) => o.id !== order.id && o.currencyPair === order.currencyPair);
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
                <td>
                  {order.status}
                  {samePairSuspended && <SuspendReasonBadge reason={getSuspendedReason(samePairSuspended.id)} />}
                </td>
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
                  <button
                    type="button"
                    onClick={() => handleSuspend(order)}
                    data-testid={`order-suspend-${order.id}`}
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResume(order)}
                    data-testid={`order-resume-${order.id}`}
                  >
                    Resume
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
