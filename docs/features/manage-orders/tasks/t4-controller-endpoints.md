---
id: T4
title: "Add fill/amend endpoints and extend cancel + exception handling in OrderController"
layer: "ports"
deps: ["T3"]
blocks: ["T6"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-06", "AC-07", "AC-10", "AC-12", "AC-13"]
files_hint: ["backend/src/main/java/com/currencyexchange/orderentry/controller/OrderController.java", "backend/src/main/java/com/currencyexchange/orderentry/dto/FillRequest.java", "backend/src/main/java/com/currencyexchange/orderentry/dto/AmendRequest.java", "backend/src/main/java/com/currencyexchange/orderentry/dto/ApiError.java", "backend/src/main/java/com/currencyexchange/orderentry/exception/GlobalExceptionHandler.java"]
owner: "Marisha"
estimate: "M"
context_budget: "M"
status: "todo"
---

# T4 — Add fill/amend endpoints and extend cancel + exception handling in OrderController

## Place in the sequence

- **Blocked by:** T3 — Implement guarded cancelOrder/fillOrder/amendOrder in OrderService. **Blocks:** T6 — Concurrency integration tests (needs the real HTTP surface to fire concurrent requests against). **Wave:** 4 (backend chain).
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

> **As a** Trader
> **I want** the order entry page to only handle creating new orders
> **So that** creating and managing orders don't clutter or duplicate the same screen
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task exposes the T3 service methods as REST endpoints so the frontend (T10–T14) has an API to call, and gives every rejection a distinct `code` the UI can react to.

## Inlined context

> Two skill defaults are deliberately overridden here: no BearerAuth (repo has no auth at all), and the Error envelope matches the repo's existing ApiError shape rather than the skill's default (existing convention, extended non-breakingly with a `code` field so new domain rejections can be told apart).
>
> — `contracts/openapi.yaml §header comment, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

> Domain exceptions (`OrderNotOpenException`, `InvalidFillAmountException`, `InvalidAmendException`) → `GlobalExceptionHandler` → uniform `ApiError` JSON, same pattern as `OrderNotFoundException`
>
> — `sad.md §8, Crosscutting concepts — Error handling, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) ·
[openapi.yaml](../contracts/openapi.yaml) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes — this task only exposes T3's service methods over HTTP.

## API contract

- `POST /api/orders/{id}/fills` → `201` `Order` · errors: `400 order.invalid_fill_amount`, `404`, `409 order.not_pending` | `409 order.fill_exceeds_remaining`.
  Request field: `amount` (number, `exclusiveMinimum: 0`).
- `PATCH /api/orders/{id}` → `200` `Order` · errors: `400` (bean validation), `404`, `409 order.not_pending` | `409 order.amend_out_of_range`.
  Request fields (at least one required): `triggerPrice`, `remainingAmount`.
- `DELETE /api/orders/{id}` (extended, existing operationId `cancelOrder`) → `200` `Order` · errors: `404`, `409` (no distinct `code` shown for cancel in the contract — reuses the generic `Error` envelope).
- `Error` schema gains an optional `code` field: `^[a-z_]+\.[a-z_]+$`, null/absent on pre-existing errors.

— `contracts/openapi.yaml, operationIds recordFill / amendOrder / cancelOrder, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

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

### AC-12 — error

> **Given** a PENDING order
> **When** the Trader attempts to amend its remaining amount above (original amount minus already-filled amount), or to exactly zero
> **Then** the system rejects the amend and explains the allowed range to the Trader
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** a PENDING order, and two different actions (any combination of cancel, fill, or amend) submitted for it at nearly the same time
> **When** both are processed
> **Then** the system applies them one at a time so the order never ends up in an inconsistent state
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `FillRequest` DTO (`amount`, bean-validated `@Positive`, mirroring `CreateOrderRequest`'s pattern) — `dto/FillRequest.java`
- [ ] `AmendRequest` DTO (`triggerPrice`/`remainingAmount`, both optional, at least one required) — `dto/AmendRequest.java`
- [ ] `POST /api/orders/{id}/fills` — calls `orderService.fillOrder`, returns `201` `Order` — `controller/OrderController.java`
- [ ] `PATCH /api/orders/{id}` — calls `orderService.amendOrder`, returns `200` `Order` — `controller/OrderController.java`
- [ ] `DELETE /api/orders/{id}` — updated to call the T3 guarded `cancelOrder` and surface `OrderNotOpenException` as `409` — `controller/OrderController.java`
- [ ] Add `code` field to `ApiError` — `dto/ApiError.java`
- [ ] Extend `GlobalExceptionHandler` to map `OrderNotOpenException` → `409 order.not_pending`, `InvalidFillAmountException` → `400`/`409` per its exceeds-remaining vs non-positive distinction with `order.invalid_fill_amount`/`order.fill_exceeds_remaining`, `InvalidAmendException` → `409 order.amend_out_of_range` — `exception/GlobalExceptionHandler.java`
- [ ] Controller-layer tests (MockMvc) for every status code + `code` value listed in the API contract above

## Edge cases

| Case | Behaviour |
|---|---|
| `id` does not resolve to any order | `404` via existing `OrderNotFoundException` path (unchanged) |
| Fill amount `<= 0` | `400 order.invalid_fill_amount` |
| Fill amount exceeds remaining on a still-PENDING order | `409 order.fill_exceeds_remaining` |
| Any action on a CANCELLED/FILLED order | `409 order.not_pending` |
| Amend `remainingAmount` outside the allowed range | `409 order.amend_out_of_range`, message names the allowed range |

## Definition of Done

- [ ] MockMvc tests confirm every status code + `code` combination above
- [ ] every Hard Rule inlined above still holds (no BearerAuth added, `ApiError` shape extended non-breakingly)
- [ ] lint + vet clean
