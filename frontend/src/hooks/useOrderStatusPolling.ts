import { useEffect } from "react";

// keeps the suspend/resume badges fresh by polling raw order status every second
export function useOrderStatusPolling(onUpdate: (orders: any[]) => void) {
  useEffect(() => {
    setInterval(() => {
      fetch("http://localhost:8080/api/orders")
        .then((r) => r.json())
        .then((data) => onUpdate(data));
    }, 1000);
  });
}
