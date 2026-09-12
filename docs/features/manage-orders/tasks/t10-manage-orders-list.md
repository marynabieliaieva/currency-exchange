---
id: T10
title: "Build the Manage Orders list screen with status-gated actions"
layer: "ui"
deps: ["T7", "T8"]
blocks: ["T11", "T12", "T13", "T14"]
acs: ["AC-14"]
files_hint: ["frontend/src/pages/ManageOrdersPage.tsx", "frontend/src/components/ManageOrdersList.tsx"]
owner: "Marisha"
estimate: "M"
context_budget: "M"
status: "todo"
---

# T10 — Build the Manage Orders list screen with status-gated actions

## Place in the sequence

- **Blocked by:** T7 — router/page shells; T8 — API client + types. **Blocks:** T11 (Cancel dialogs), T12 (Fill dialog), T13 (Amend dialog), T14 (Fill trail) — all four wire their trigger button into this list. **Wave:** 2 (frontend chain).
- **Lane:** own lane at this point — becomes the shared lane for T11–T14 (each of those tasks also touches `ManageOrdersList.tsx` to wire in its dialog trigger, so `implement` serializes T11–T14 against each other on that file).

## Why (user story)

> **As a** Trader
> **I want** to see the individual fills recorded against an order
> **So that** I can trust how its remaining amount was derived
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task builds the base list/table (fetch, render every status, gate the action buttons) that T11–T14 attach their dialogs to and that US-04's fill trail (T14) expands into.

## Inlined context

> Trader->>Web: opens the Manage Orders screen
> Web->>API: requests all orders
> API->>DB: reads orders in every status
> DB-->>API: orders (PENDING, CANCELLED, FILLED)
> API-->>Web: full list
> Web-->>Trader: orders listed; Cancel/Fill/Amend enabled only on PENDING rows
>
> — `sad.md §6, «Critical flow 5: View the order list and an order's fill trail» steps, abridged` · full text: [sad.md](../sad.md)

> | loading | `GET /api/orders` in flight | NEW: LoadingIndicator (plain text, no primitive exists) | wireframe below |
> | empty | List returns `[]` — reuses `OrderList.tsx`'s existing "No orders yet." text | EmptyStateText (existing) | wireframe below |
> | default | Populated table; PENDING rows' Cancel/Fill/Amend enabled, CANCELLED/FILLED rows' disabled (AC-14) | OrderTable, RowActionButton (existing disabled-button pattern) | wireframe below |
> | error | `GET /api/orders` fails — reuses `App.tsx`'s existing `loadError` pattern | InlineErrorText (existing) | wireframe below |
>
> — `screens.md §SCR-02 Manage Orders screen, state table, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

- `GET /api/orders` → `200` `Order[]` — no pagination, returns every status.

— `contracts/openapi.yaml, operationId listOrders, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

## Acceptance criteria

### AC-14 — happy path

> **Given** the Trader has orders in every status (PENDING, CANCELLED, FILLED)
> **When** the Trader opens the Manage Orders screen
> **Then** the system lists all of them regardless of status, with Cancel/Fill/Amend available only on PENDING orders and disabled on CANCELLED/FILLED ones
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `ManageOrdersPage` calls `listOrders()` on mount, holds `orders`/`loading`/`error` state — `frontend/src/pages/ManageOrdersPage.tsx`
- [ ] `ManageOrdersList` renders a table row per order (pair, side, type, price, amount, remaining, status), reusing `OrderList.tsx`'s existing disabled-row/table styling pattern — `frontend/src/components/ManageOrdersList.tsx`
- [ ] Cancel/Fill/Amend buttons rendered per PENDING row, disabled (or absent) on CANCELLED/FILLED rows — button click handlers are stubs here; T11–T13 wire in the actual dialogs
- [ ] Loading state ("Loading orders...") while the fetch is in flight
- [ ] Empty state ("No orders yet.") when the list is `[]`
- [ ] Error state (reuse `App.tsx`'s existing `loadError` inline-text pattern) when `GET /api/orders` fails
- [ ] Row expand affordance present per row with ≥1 fill event (the actual expand content is T14)

## Edge cases

| Case | Behaviour |
|---|---|
| `GET /api/orders` fails | Inline error text shown, no table rendered |
| Order has `remainingAmount` from the AC-11 server-side fallback | Displayed as-is — the client never recomputes it, the API always returns a populated value |
| Mixed statuses in one list | PENDING rows show enabled action buttons; CANCELLED/FILLED rows show disabled ones, all in the same table |

## Definition of Done

- [ ] Manage Orders screen lists every order regardless of status (AC-14)
- [ ] action buttons enabled only on PENDING rows, disabled on CANCELLED/FILLED rows (AC-14)
- [ ] loading/empty/error states each render correctly
- [ ] `npm run build` passes
- [ ] lint clean
