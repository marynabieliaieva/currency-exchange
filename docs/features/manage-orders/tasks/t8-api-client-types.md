---
id: T8
title: "Extend the API client and TS types for fill/amend/remainingAmount/FillEvent"
layer: "wiring"
deps: []
blocks: ["T10"]
acs: []
files_hint: ["frontend/src/api/orderApi.ts", "frontend/src/types/order.ts"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T8 — Extend the API client and TS types for fill/amend/remainingAmount/FillEvent

## Place in the sequence

- **Blocked by:** none — derives from the fixed `openapi.yaml` contract, not from the backend actually being implemented. **Blocks:** T10 — Build the Manage Orders list screen (needs `Order.remainingAmount`/`fillEvents` types and the list-fetch call). **Wave:** 1 (can start immediately, in parallel with T1–T7).
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

This task has no single corresponding user story — it is the shared typed API surface every UI task (T9–T14) builds on.

## Inlined context

> `types/order.ts` — TS types mirroring the backend's enums and DTOs; keep these in sync with the Java side by hand (no shared schema/codegen).
> `api/orderApi.ts` — thin `fetch` wrapper (`createOrder`, `listOrders`, `cancelOrder`); the only module that knows about `VITE_API_BASE_URL` and the API's JSON shape.
>
> — `CLAUDE.md §Architecture, Frontend, verbatim` · full text: `CLAUDE.md` (repo root)

> `api/orderApi.ts` extended: `fillOrder(id, amount)`, `amendOrder(id, {price?, remainingAmount?})`
> `types/order.ts` extended: FILLED status, remainingAmount, FillEvent
>
> — `sad.md §5, Internal decomposition (frontend/src/), verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [openapi.yaml](../contracts/openapi.yaml)) and follow it. Do not guess.

## Data delta

No DB changes — this task mirrors the `Order`/`FillEvent` shapes the backend already defines (T1/T4), it does not define them.

## API contract

- `Order` gains `remainingAmount: number`, `status: "PENDING" | "CANCELLED" | "FILLED"`, `fillEvents: FillEvent[]`.
- `FillEvent`: `{ amount: number, timestamp: string }`.
- `fillOrder(id: string, amount: number): Promise<Order>` → `POST /api/orders/{id}/fills`.
- `amendOrder(id: string, body: { triggerPrice?: number, remainingAmount?: number }): Promise<Order>` → `PATCH /api/orders/{id}`.
- Both throw/surface the existing `ApiError` shape (now including an optional `code` field) on non-2xx, following `orderApi.ts`'s existing error-handling pattern for `createOrder`/`cancelOrder`.

— `contracts/openapi.yaml, schemas Order/FillEvent, operationIds recordFill/amendOrder, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

## Acceptance criteria

No spec §5 AC maps directly to this task — it is the typed plumbing that T9–T15 consume to satisfy their ACs.

## Checklist

- [ ] Add `FillEvent` type and extend `Order`/`OrderStatus` types (`remainingAmount`, `fillEvents`, `FILLED`) — `frontend/src/types/order.ts`
- [ ] Add `fillOrder(id, amount)` calling `POST /api/orders/{id}/fills` — `frontend/src/api/orderApi.ts`
- [ ] Add `amendOrder(id, { triggerPrice?, remainingAmount? })` calling `PATCH /api/orders/{id}` — `frontend/src/api/orderApi.ts`
- [ ] Extend the `ApiError`-shaped type (if separately typed) with the optional `code` field
- [ ] `tsc -b` passes with no `any` introduced for these new members

## Edge cases

| Case | Behaviour |
|---|---|
| API returns a `409` with a `code` field | `fillOrder`/`amendOrder` reject with an error object exposing `code`, so the calling dialog (T12/T13) can branch on it |
| API returns a `409` with no `code` (pre-existing error path) | `code` is `undefined`/`null` — calling code must handle its absence, not assume it's always present |

## Definition of Done

- [ ] `fillOrder`/`amendOrder` compile and are callable with the extended types
- [ ] `tsc -b` passes
- [ ] lint clean
