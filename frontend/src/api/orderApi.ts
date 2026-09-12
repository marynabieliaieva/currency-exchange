import type { CreateOrderRequest, Order } from "../types/order";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.messages?.join(", ") ?? `Request failed with status ${response.status}`;
    throw new Error(message);
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
