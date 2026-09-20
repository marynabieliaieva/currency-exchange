export type OrderSide = "BUY" | "SELL";

export type OrderType = "TAKE_PROFIT" | "STOP_LOSS";

export type OrderStatus = "PENDING" | "CANCELLED" | "FILLED";

export interface FillEvent {
  amount: number;
  timestamp: string;
}

export interface Order {
  id: string;
  currencyPair: string;
  side: OrderSide;
  type: OrderType;
  triggerPrice: number;
  amount: number;
  remainingAmount: number;
  status: OrderStatus;
  fillEvents: FillEvent[];
  createdAt: string;
}

export interface CreateOrderRequest {
  currencyPair: string;
  side: OrderSide;
  type: OrderType;
  triggerPrice: number;
  amount: number;
}

export interface AmendOrderRequest {
  triggerPrice?: number;
  remainingAmount?: number;
}
