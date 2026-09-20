---
id: T3
title: "Implement guarded cancelOrder, fillOrder, and amendOrder in OrderService"
layer: "app"
deps: ["T2"]
blocks: ["T4"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-10", "AC-11", "AC-12", "AC-13"]
files_hint: ["backend/src/main/java/com/currencyexchange/orderentry/service/OrderService.java", "backend/src/main/java/com/currencyexchange/orderentry/exception/OrderNotOpenException.java", "backend/src/main/java/com/currencyexchange/orderentry/exception/InvalidFillAmountException.java", "backend/src/main/java/com/currencyexchange/orderentry/exception/InvalidAmendException.java"]
owner: "Marisha"
estimate: "L"
context_budget: "L"   # justified: three guarded actions (cancel/fill/amend) share one service class and must be reviewed together for the AC-11 fallback + re-read-for-reason pattern to be consistent across all three
status: "todo"
---

# T3 — Implement guarded cancelOrder, fillOrder, and amendOrder in OrderService

## Place in the sequence

- **Blocked by:** T2 — Atomic conditional update helpers (this task calls `OrderMongoOperations.tryCancel/tryFill/tryAmend`, which already builds on T1's model changes transitively). **Blocks:** T4 — Add fill/amend endpoints and extend controller (the controller calls this service). **Wave:** 3 (backend chain).
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

> **As a** Trader
> **I want** to cancel a pending order
> **So that** it stops being open when I no longer intend to trade it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **As a** Trader
> **I want** to record that an order was fully or partially executed
> **So that** its remaining amount reflects reality without editing the database
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

> **As a** Trader
> **I want** to adjust a pending order's trigger price and/or remaining amount
> **So that** I can correct or adapt it without cancelling and recreating it
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

This task is the service-layer implementation of all three actions, using the T2 atomic-update helpers to satisfy the concurrency guarantee and adding the re-read-for-reason pattern that lets the Trader know *why* a rejected action failed.

## Inlined context

> Only fill mutates `remainingAmount` and appends a fill event as part of its write. When a guard fails, the service issues a plain read of the current order to distinguish *why* — already closed vs. amount out of range — rather than surfacing one generic rejection for every failure.
>
> — `adr/0001-atomic-conditional-update-for-order-actions.md §Decision outcome, verbatim` · full text: [adr/0001-atomic-conditional-update-for-order-actions.md](../adr/0001-atomic-conditional-update-for-order-actions.md)

> API->>DB: atomic conditional update (status=PENDING, effective remaining >= amount)
> alt condition holds
>     DB-->>API: updated order (remaining reduced, fill event appended)
> else condition fails
>     DB-->>API: no matching document
>     API->>DB: re-reads the order to tell "no longer PENDING" apart from "amount exceeds what's left"
>     DB-->>API: current status and remaining amount
>     API-->>Web: rejection naming the actual reason
>
> — `sad.md §6, «Critical flow 1: Record a fill» steps, abridged` · full text: [sad.md](../sad.md)

> API->>DB: atomic conditional update (status=PENDING AND new remaining amount within allowed range)
> alt condition holds
>     DB-->>API: updated order (already-filled portion and its fill events untouched)
> else condition fails
>     DB-->>API: no matching document
>     API->>DB: re-reads the order to tell "no longer PENDING" apart from "value outside the allowed range"
>
> — `sad.md §6, «Critical flow 4: Amend a pending order» steps, abridged` · full text: [sad.md](../sad.md)

> `OrderService` (extended: guarded cancelOrder, new fillOrder, new amendOrder)
>
> — `sad.md §5, Internal decomposition (service/), verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) ·
[openapi.yaml](../contracts/openapi.yaml) · [adr/0001-atomic-conditional-update-for-order-actions.md](../adr/0001-atomic-conditional-update-for-order-actions.md)) and follow it. Do not guess.

## Data delta

No new fields — reads/mutates the `status`, `remainingAmount`, `fillEvents` fields T1 added, exclusively through the T2 `OrderMongoOperations` helpers (never a direct `save()` for these three actions).

— `data-model.md §Entities, table Order, abridged` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface directly; this is the service layer the T4 controller calls. The three new domain exceptions (`OrderNotOpenException`, `InvalidFillAmountException`, `InvalidAmendException`) are what T4's `GlobalExceptionHandler` extension maps to `409`/`400` responses.

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

### AC-10 — error

> **Given** an order that is CANCELLED or FILLED
> **When** the Trader attempts to cancel, fill, or amend it
> **Then** the system rejects the action and tells the Trader the order is no longer open
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — domain invariant

> **Given** a PENDING order created before this feature existed, with no remaining amount ever recorded for it
> **When** the Trader views it or acts on it
> **Then** the system treats its remaining amount as equal to its original amount, as if zero fill events had been recorded
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — error

> **Given** a PENDING order
> **When** the Trader attempts to amend its remaining amount above (original amount minus already-filled amount), or to exactly zero
> **Then** the system rejects the amend and explains the allowed range to the Trader
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** a PENDING order, and two different actions (any combination of cancel, fill, or amend) submitted for it at nearly the same time
> **When** both are processed
> **Then** the system applies them one at a time so the order never ends up in an inconsistent state — for example, a fill racing a concurrent cancel on the same order is rejected once the cancel has taken effect, never silently recorded against a closed order
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `cancelOrder(id)` — call `OrderMongoOperations.tryCancel(id)`; on empty, re-read the order (`OrderNotFoundException` if absent, else `OrderNotOpenException` naming its current status) — `service/OrderService.java`
- [ ] `fillOrder(id, amount)` — validate `amount > 0` locally first (else `InvalidFillAmountException`, AC-04's "not a positive number" branch); call `tryFill`; on empty, re-read to distinguish `OrderNotOpenException` (not PENDING) from `InvalidFillAmountException` (exceeds remaining, AC-04's other branch) — `service/OrderService.java`
- [ ] `amendOrder(id, price?, remainingAmount?)` — validate the supplied `remainingAmount` (if present) is `> 0` locally (else `InvalidAmendException`); call `tryAmend`; on empty, re-read to distinguish `OrderNotOpenException` from `InvalidAmendException` naming the allowed range (AC-12) — `service/OrderService.java`
- [ ] Create `OrderNotOpenException`, `InvalidFillAmountException`, `InvalidAmendException` following `OrderNotFoundException`'s existing pattern — `exception/*.java`
- [ ] All three actions go through `OrderMongoOperations`, never `orderRepository.save()` directly, for these fields
- [ ] Unit tests (mocked repository/`OrderMongoOperations`, extending `OrderServiceTest`'s existing inline-construction style) for every AC listed above

## Edge cases

| Case | Behaviour |
|---|---|
| Fill amount is zero or negative | Rejected before any DB call — `InvalidFillAmountException` ("not a positive number") |
| Fill amount exceeds remaining, order still PENDING | `tryFill` guard fails; re-read shows still-PENDING → `InvalidFillAmountException` ("exceeds what's left on the order") |
| Cancel/Fill/Amend on an order that closed between row-render and click (AC-10/AC-13 race) | `try*` guard fails; re-read shows CANCELLED/FILLED → `OrderNotOpenException` |
| Amend `remainingAmount` above `(amount - alreadyFilled)` or exactly `0` | `tryAmend` guard fails; re-read → `InvalidAmendException` naming the allowed range |
| Legacy order with `remainingAmount == null` | `fillOrder`/`amendOrder` treat effective remaining as `amount` (AC-11); guard in T2 already encodes this, service just passes through |

## Definition of Done

- [ ] unit tests for cancel/fill/amend happy paths and every rejection reason above pass
- [ ] every Hard Rule inlined above still holds (re-read-for-reason pattern used consistently for all three actions)
- [ ] lint + vet clean
