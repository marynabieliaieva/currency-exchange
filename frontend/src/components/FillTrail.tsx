import type { FillEvent } from "../types/order";

interface FillTrailProps {
  fillEvents: FillEvent[];
}

export function FillTrail({ fillEvents }: FillTrailProps) {
  return (
    <ul className="fill-trail">
      {fillEvents.map((fill, index) => (
        <li key={index}>
          {fill.amount} at {new Date(fill.timestamp).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
