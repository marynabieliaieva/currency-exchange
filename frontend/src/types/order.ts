export type OrderSide = "BUY" | "SELL";

export type OrderType = "TAKE_PROFIT" | "STOP_LOSS";

export type OrderStatus = "PENDING" | "CANCELLED";

export interface Order {
  id: string;
  currencyPair: string;
  side: OrderSide;
  type: OrderType;
  triggerPrice: number;
  amount: number;
  status: OrderStatus;
  createdAt: string;
}

export interface CreateOrderRequest {
  currencyPair: string;
  side: OrderSide;
  type: OrderType;
  triggerPrice: number;
  amount: number;
}
