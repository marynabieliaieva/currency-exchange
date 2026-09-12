---
id: T13
title: "Build the Amend entry dialog"
layer: "ui"
deps: ["T10"]
blocks: ["T15"]
acs: ["AC-06", "AC-07", "AC-12"]
files_hint: ["frontend/src/components/AmendDialog.tsx", "frontend/src/components/ManageOrdersList.tsx"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T13 — Build the Amend entry dialog

## Place in the sequence

- **Blocked by:** T10 — Build the Manage Orders list screen (needs the row + Amend button to attach to). **Blocks:** T15 — Frontend e2e tests (covers AC-06/AC-07/AC-12). **Wave:** 3 (frontend chain, parallel with T11/T12/T14).
- **Lane:** shares `frontend/src/components/ManageOrdersList.tsx` with T11, T12, T14 — `implement` serializes these four against each other on that file.

## Why (user story)

> **As a** Trader
> **I want** to adjust a pending order's trigger price and/or remaining amount
> **So that** I can correct or adapt it without cancelling and recreating it
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

## Inlined context

> Trader->>Web: submits a new trigger price and/or remaining amount
> Web->>API: requests the amend
> alt condition holds
>     API-->>Web: amend applied, new values
>     Web-->>Trader: confirmation showing the new values
> else condition fails
>     API-->>Web: rejection naming the actual reason
>     Web-->>Trader: inline rejection explaining the allowed range, order unchanged
>
> — `sad.md §6, «Critical flow 4: Amend a pending order» steps, abridged` · full text: [sad.md](../sad.md)

> | default | Amend clicked; fields pre-filled with the order's current triggerPrice/remainingAmount | NEW: AmendDialogForm | wireframe below |
> | error | Rejected inline, one banner covering 3 reasons: outside the allowed range (409 `order.amend_out_of_range`, AC-12), order no longer PENDING (409 `order.not_pending`, AC-10 race), bad format (400 bean validation) | InlineStatusBanner (error, in-dialog) | wireframe below |
>
> — `screens.md §SCR-06 Amend entry dialog, state table, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

- `PATCH /api/orders/{id}` → `200` `Order` · errors: `400` (bean validation), `404`, `409 order.not_pending` | `409 order.amend_out_of_range`.
  Request fields (at least one required): `triggerPrice`, `remainingAmount`.

— `contracts/openapi.yaml, operationId amendOrder, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

## Acceptance criteria

### AC-06 — happy path

> **Given** a PENDING order
> **When** the Trader amends its trigger price and/or remaining amount to a new valid value
> **Then** the system updates the order and confirms the new values to the Trader
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — cross-context

> **Given** a PENDING order that already has one or more fill events recorded against it (a related but separately-tracked record set)
> **When** the Trader amends the order
> **Then** the system only ever lets the amend change the remaining (unfilled) amount — never above the order's original amount minus its already-filled amount, and never to exactly zero (the Trader must use Cancel for that) — the already-filled portion, and its fill events, are never altered or reduced by an amend
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — error

> **Given** a PENDING order
> **When** the Trader attempts to amend its remaining amount above (original amount minus already-filled amount), or to exactly zero
> **Then** the system rejects the amend and explains the allowed range to the Trader
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `AmendDialog` — fields pre-filled with the order's current `triggerPrice`/`remainingAmount`, shows "filled so far: X" for context, `[Cancel] [Amend]` — `frontend/src/components/AmendDialog.tsx`
- [ ] Wire the Amend button in `ManageOrdersList` (PENDING rows only) to open `AmendDialog` — `frontend/src/components/ManageOrdersList.tsx`
- [ ] Amend button (and inputs) disabled while `PATCH` is in flight
- [ ] One inline error banner covering all three rejection reasons: outside the allowed range, order no longer PENDING, bad format — dialog stays open on error
- [ ] On success, dialog closes; new values confirmed on the row (owned by T10)

## Edge cases

| Case | Behaviour |
|---|---|
| Requested `remainingAmount` above `(amount - alreadyFilled)` | Inline error naming the allowed range (409 `order.amend_out_of_range`) |
| Requested `remainingAmount` exactly `0` | Same rejection — Trader is told to use Cancel instead |
| Order closed moments earlier by a concurrent action (AC-10/AC-13 race) | Inline error: "order is no longer open" |
| Only `triggerPrice` supplied, `remainingAmount` omitted | Valid partial amend — already-filled portion and fill events untouched either way (AC-07) |

## Definition of Done

- [ ] a valid amend updates the order and closes the dialog with new values shown (AC-06, AC-07)
- [ ] an out-of-range or exactly-zero `remainingAmount` is rejected inline with the allowed range explained (AC-12)
- [ ] `npm run build` passes
- [ ] lint clean
