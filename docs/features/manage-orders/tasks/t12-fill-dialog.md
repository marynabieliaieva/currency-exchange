---
id: T12
title: "Build the Fill entry dialog"
layer: "ui"
deps: ["T10"]
blocks: ["T15"]
acs: ["AC-03", "AC-04", "AC-05"]
files_hint: ["frontend/src/components/FillDialog.tsx", "frontend/src/components/ManageOrdersList.tsx"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T12 — Build the Fill entry dialog

## Place in the sequence

- **Blocked by:** T10 — Build the Manage Orders list screen (needs the row + Fill button to attach to). **Blocks:** T15 — Frontend e2e tests (covers AC-03/AC-04/AC-05). **Wave:** 3 (frontend chain, parallel with T11/T13/T14).
- **Lane:** shares `frontend/src/components/ManageOrdersList.tsx` with T11, T13, T14 — `implement` serializes these four against each other on that file.

## Why (user story)

> **As a** Trader
> **I want** to record that an order was fully or partially executed
> **So that** its remaining amount reflects reality without editing the database
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

## Inlined context

> Trader->>Web: submits a fill amount for a PENDING order
> Web->>API: requests the fill
> alt condition holds
>     API-->>Web: fill recorded, new remaining amount
>     Web-->>Trader: confirmation (and FILLED status if remaining reached zero)
> else condition fails
>     API-->>Web: rejection naming the actual reason
>     Web-->>Trader: inline rejection, remaining amount unchanged
>
> — `sad.md §6, «Critical flow 1: Record a fill» steps, abridged` · full text: [sad.md](../sad.md)

> | error | Rejected inline, one banner covering 3 reasons: non-positive amount (400 `order.invalid_fill_amount`, AC-04), amount exceeds remaining (409 `order.fill_exceeds_remaining`, AC-04), order no longer PENDING (409 `order.not_pending`, AC-10 race) | InlineStatusBanner (error, in-dialog) | wireframe below |
> | success | Fill recorded (AC-03) — dialog closes; confirmation and any FILLED transition shown on the SCR-02 row, not inside this dialog | — (transient, closes) | wireframe below |
>
> — `screens.md §SCR-05 Fill entry dialog, state table, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

- `POST /api/orders/{id}/fills` → `201` `Order` · errors: `400 order.invalid_fill_amount`, `404`, `409 order.not_pending` | `409 order.fill_exceeds_remaining`.

— `contracts/openapi.yaml, operationId recordFill, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

## Acceptance criteria

### AC-03 — happy path

> **Given** a PENDING order with a remaining amount greater than zero
> **When** the Trader records a fill for an amount at or below the remaining amount
> **Then** the system records a new fill event (the amount and the current time as its timestamp), reduces the order's remaining amount accordingly, confirms to the Trader, and — if the remaining amount reaches zero — marks the order FILLED
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — error

> **Given** a PENDING order with a remaining amount
> **When** the Trader attempts to record a fill that is zero, negative, or greater than the remaining amount
> **Then** the system rejects the fill, tells the Trader why (not a positive number, or exceeds what's left on the order), and leaves the remaining amount unchanged
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — domain invariant

> **Given** a PENDING order with a remaining amount, and two fill requests submitted for it at nearly the same time whose combined amount would exceed the remaining amount
> **When** both are processed
> **Then** the system processes them one at a time; whichever fill would leave the remaining amount negative is rejected in full, exactly as in AC-04 — never partially applied — so the order's remaining amount never goes below zero
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `FillDialog` — shows the order's pair/side and current remaining amount, an amount input, `[Cancel] [Record]` — `frontend/src/components/FillDialog.tsx`
- [ ] Wire the Fill button in `ManageOrdersList` (PENDING rows only) to open `FillDialog` — `frontend/src/components/ManageOrdersList.tsx`
- [ ] Record button (and input) disabled while `POST /fills` is in flight (double-submit guard)
- [ ] One inline error banner covering all three rejection reasons: non-positive amount, exceeds remaining, order no longer PENDING — the dialog stays open on error
- [ ] On success, dialog closes; the row (owned by T10) reflects the new remaining amount and any FILLED transition — this task does not render success feedback inside the dialog itself

## Edge cases

| Case | Behaviour |
|---|---|
| Amount is zero or negative | Inline error: "amount must be greater than 0" (400 `order.invalid_fill_amount`) |
| Amount exceeds remaining | Inline error: "amount exceeds what's left on the order" (409 `order.fill_exceeds_remaining`) |
| Order closed moments earlier by a concurrent action (AC-05/AC-10 race, this fill loses) | Inline error: "order is no longer open" (409 `order.not_pending`) — same rejection surface as a single-attempt overfill |
| Fill reduces remaining exactly to zero | Server marks FILLED; dialog closes normally, row shows FILLED |

## Definition of Done

- [ ] a valid fill records and closes the dialog, row reflects the new remaining/FILLED state (AC-03)
- [ ] every rejection reason in AC-04/AC-05 shows inline without closing the dialog
- [ ] Record disabled while in flight
- [ ] `npm run build` passes
- [ ] lint clean
