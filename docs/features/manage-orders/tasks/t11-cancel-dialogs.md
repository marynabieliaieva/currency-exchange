---
id: T11
title: "Build the Cancel and Cancel-with-forfeiture dialogs"
layer: "ui"
deps: ["T10"]
blocks: ["T15"]
acs: ["AC-01", "AC-02"]
files_hint: ["frontend/src/components/CancelDialog.tsx", "frontend/src/components/CancelForfeitureDialog.tsx", "frontend/src/components/ManageOrdersList.tsx"]
owner: "Marisha"
estimate: "M"
context_budget: "M"
status: "todo"
---

# T11 — Build the Cancel and Cancel-with-forfeiture dialogs

## Place in the sequence

- **Blocked by:** T10 — Build the Manage Orders list screen (needs the row + Cancel button to attach to). **Blocks:** T15 — Frontend e2e tests (covers AC-01/AC-02). **Wave:** 3 (frontend chain, parallel with T12/T13/T14).
- **Lane:** shares `frontend/src/components/ManageOrdersList.tsx` with T12, T13, T14 — `implement` serializes these four against each other on that file even though `ui` tasks are not auto-serialized by layer.

## Why (user story)

> **As a** Trader
> **I want** to cancel a pending order
> **So that** it stops being open when I no longer intend to trade it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

## Inlined context

> Trader->>Web: requests cancel on an order with no recorded fills
> Web-->>Trader: simple cancel confirmation dialog
> Trader->>Web: confirms
> Web->>API: confirms the cancel
>
> — `sad.md §6, «Critical flow 3: Cancel a pending order with no fills» steps, abridged` · full text: [sad.md](../sad.md)

> Trader->>Web: requests cancel on an order with recorded fills
> Web->>API: asks how much is already filled
> API-->>Web: amount that would be forfeited
> Web-->>Trader: forfeiture confirmation dialog
> Trader->>Web: confirms forfeiture
>
> — `sad.md §6, «Critical flow 2: Cancel an order that already has fills» steps, abridged` · full text: [sad.md](../sad.md)

> Each action button (Cancel/Fill/Amend) is disabled for the duration of its in-flight request and re-enabled on response, success or rejection — a UI-side belt alongside the DB-side atomic guard.
>
> — `sad.md §8, Crosscutting concepts — Double-submit guard (client), verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

- `DELETE /api/orders/{id}` → `200` `Order` · errors: `404`, `409` (generic `Error` envelope — order no longer PENDING).

— `contracts/openapi.yaml, operationId cancelOrder, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

## Acceptance criteria

### AC-01 — happy path

> **Given** a PENDING order with no fill events
> **When** the Trader confirms cancelling it
> **Then** the system marks it CANCELLED and confirms to the Trader
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — domain invariant

> **Given** a PENDING order that already has one or more fill events
> **When** the Trader attempts to cancel it
> **Then** the system tells the Trader how much has already been filled and requires an explicit second confirmation naming that cancelling permanently forfeits the remaining (unfilled) amount, before proceeding; once cancelled, the order's status becomes CANCELLED and its remaining amount value is left unchanged (not reset), since it is now permanently unfillable
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `CancelDialog` — for fill-free orders: states the order, `[Dismiss] [Confirm]`, calls `cancelOrder(id)` on confirm — `frontend/src/components/CancelDialog.tsx`
- [ ] `CancelForfeitureDialog` — for orders with `fillEvents.length > 0`: states "Already filled: X. Cancelling permanently forfeits the remaining Y.", `[Dismiss] [Confirm forfeiture]`, calls `cancelOrder(id)` on confirm — `frontend/src/components/CancelForfeitureDialog.tsx`
- [ ] Wire the Cancel button in `ManageOrdersList` to open `CancelDialog` when `fillEvents.length === 0`, else `CancelForfeitureDialog` — `frontend/src/components/ManageOrdersList.tsx`
- [ ] Confirm button disabled while the `DELETE` request is in flight (double-submit guard, both dialogs)
- [ ] Inline rejection shown in-dialog on `404`/`409` (order vanished, or no longer PENDING — AC-10 race) instead of closing the dialog
- [ ] On success, dialog closes and the row updates to CANCELLED with `remainingAmount` unchanged (server already leaves it unchanged per AC-02 — no client-side reset)

## Edge cases

| Case | Behaviour |
|---|---|
| Order has 0 fill events | `CancelDialog` (simple confirm) |
| Order has ≥1 fill event | `CancelForfeitureDialog` (states forfeited amount, requires explicit second confirmation) |
| Cancel confirmed but order closed moments earlier by a concurrent action (AC-10/AC-13 race) | Dialog shows the rejection inline ("order is no longer open"), does not silently close |
| Double-click Confirm | Second click has no effect — button already disabled from the first in-flight request |

## Definition of Done

- [ ] fill-free cancel shows the simple dialog and results in CANCELLED on confirm (AC-01)
- [ ] cancel-with-fills shows the forfeiture dialog naming the forfeited amount and requires explicit confirmation (AC-02)
- [ ] both dialogs disable Confirm while in flight and show inline rejection on error
- [ ] `npm run build` passes
- [ ] lint clean
