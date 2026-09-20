import type { AmendOrderRequest, CreateOrderRequest, Order } from "../types/order";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.messages?.join(", ") ?? `Request failed with status ${response.status}`;
    throw new ApiRequestError(message, response.status, body?.code ?? undefined);
  }
  return response.json() as Promise<T>;
}

export async function createOrder(request: CreateOrderRequest): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<Order>(response);
}

export async function listOrders(): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/api/orders`);
  return handleResponse<Order[]>(response);
}

export async function cancelOrder(id: string): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
    method: "DELETE",
  });
  return handleResponse<Order>(response);
}

export async function fillOrder(id: string, amount: number): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${id}/fills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  return handleResponse<Order>(response);
}

export async function amendOrder(id: string, body: AmendOrderRequest): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<Order>(response);
}
