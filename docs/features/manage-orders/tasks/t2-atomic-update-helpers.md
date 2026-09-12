---
id: T2
title: "Add MongoTemplate-based atomic conditional update helpers for cancel/fill/amend"
layer: "infra"
deps: ["T1"]
blocks: ["T3"]
acs: ["AC-05", "AC-13"]
files_hint: ["backend/src/main/java/com/currencyexchange/orderentry/repository/OrderMongoOperations.java", "backend/src/main/java/com/currencyexchange/orderentry/repository/OrderRepository.java"]
owner: "Marisha"
estimate: "M"
context_budget: "M"
status: "todo"
---

# T2 — Add MongoTemplate-based atomic conditional update helpers for cancel/fill/amend

## Place in the sequence

- **Blocked by:** T1 — Extend Order model with FILLED status, remainingAmount, and embedded FillEvent. **Blocks:** T3 — Implement guarded cancelOrder/fillOrder/amendOrder (the service layer calls these helpers). **Wave:** 2 (backend chain).
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

> **As a** Trader
> **I want** the system to reject a fill that exceeds what's left on an order, and to never let a double-submitted fill overcount
> **So that** an order's remaining amount is always trustworthy, even when I make a mistake or double-click
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task builds the data-layer mechanism (a single guarded `findAndModify` per action) that makes that guarantee true by construction.

## Inlined context

> **Atomic conditional update over an embedded array** — a single `findOneAndUpdate` guards on `status = PENDING` and a sufficient remaining amount, and in the same atomic document write decrements `remainingAmount` and pushes the new fill event into an embedded `fillEvents` array on the `Order` document. ... Fill, cancel, and amend each guard a different condition through this same mechanism, not a single shared precondition: fill's guard is `status = PENDING` AND `effectiveRemaining >= amount` (falling back to the order's original amount when `remainingAmount` was never recorded); cancel's guard is only `status = PENDING`; amend's guard is `status = PENDING` AND the requested value staying inside the allowed range. Only fill mutates `remainingAmount` and appends a fill event as part of its write.
>
> — `adr/0001-atomic-conditional-update-for-order-actions.md §Decision outcome, verbatim` · full text: [adr/0001-atomic-conditional-update-for-order-actions.md](../adr/0001-atomic-conditional-update-for-order-actions.md)

> **Hard rule:** The repo's MongoDB instance is a standalone single-node deployment — multi-document ACID transactions require a replica set, which isn't part of this stack today, so any option needing transactions carries extra ops cost this feature shouldn't force.
>
> — `adr/0001-atomic-conditional-update-for-order-actions.md §Decision drivers, verbatim` · full text: [adr/0001-atomic-conditional-update-for-order-actions.md](../adr/0001-atomic-conditional-update-for-order-actions.md)

> `OrderMongoOperations` (new: `MongoTemplate`-based atomic update helpers, ADR-0001)
>
> — `sad.md §5, Internal decomposition (repository/), verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) ·
[openapi.yaml](../contracts/openapi.yaml) · [adr/0001-atomic-conditional-update-for-order-actions.md](../adr/0001-atomic-conditional-update-for-order-actions.md)) and follow it. Do not guess.

## Data delta

No new fields — reads/writes the fields T1 added (`status`, `remainingAmount`, `fillEvents`) via `MongoTemplate.findAndModify`, not the `MongoRepository` used elsewhere.

— `data-model.md §Entities, table Order, abridged` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface. This is a repository-layer helper consumed by `OrderService` in T3.

## Acceptance criteria

### AC-05 — domain invariant

> **Given** a PENDING order with a remaining amount, and two fill requests submitted for it at nearly the same time whose combined amount would exceed the remaining amount
> **When** both are processed
> **Then** the system processes them one at a time; whichever fill would leave the remaining amount negative is rejected in full, exactly as in AC-04 — never partially applied — so the order's remaining amount never goes below zero
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** a PENDING order, and two different actions (any combination of cancel, fill, or amend) submitted for it at nearly the same time
> **When** both are processed
> **Then** the system applies them one at a time so the order never ends up in an inconsistent state — for example, a fill racing a concurrent cancel on the same order is rejected once the cancel has taken effect, never silently recorded against a closed order
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Create `OrderMongoOperations` wrapping `MongoTemplate` — `backend/src/main/java/com/currencyexchange/orderentry/repository/OrderMongoOperations.java`
- [ ] `tryCancel(id)` — guard `status = PENDING`; on match, set `status = CANCELLED` (leave `remainingAmount`/`fillEvents` untouched); return `Optional<Order>` (empty on no match)
- [ ] `tryFill(id, amount)` — guard `status = PENDING AND effectiveRemaining >= amount` (compute `effectiveRemaining` as `remainingAmount != null ? remainingAmount : amount` in the query, per AC-11); on match, `$inc` remaining down by `amount`, `$push` a new `FillEvent(amount, Instant.now())`, and set `status = FILLED` when the resulting remaining is zero; return `Optional<Order>`
- [ ] `tryAmend(id, newPrice?, newRemaining?)` — guard `status = PENDING AND newRemaining > 0 AND newRemaining <= (amount - alreadyFilled)` when `newRemaining` is supplied; on match, set the supplied field(s); return `Optional<Order>`
- [ ] Each `try*` method uses a single `findAndModify` call — no read-then-write race window
- [ ] Unit tests for each guard (match and no-match cases) against a real or embedded MongoDB

## Edge cases

| Case | Behaviour |
|---|---|
| Two concurrent `tryFill` calls on the same order, combined amount exceeds remaining | Mongo serializes the two writes; the second one's guard condition (recomputed against the now-updated document) no longer holds, so it returns empty — never a negative remaining amount |
| `tryFill`/`tryCancel`/`tryAmend` called on an order already `CANCELLED`/`FILLED` | Guard's `status = PENDING` clause fails; returns empty, no document read is required to know this failed (caller re-reads separately to explain why) |
| Order has no `remainingAmount` ever recorded (AC-11 legacy order) | `tryFill`'s guard computes `effectiveRemaining` as the order's `amount` field, not `remainingAmount` |

## Definition of Done

- [ ] unit tests for `tryCancel`/`tryFill`/`tryAmend` (match + no-match cases) pass
- [ ] every Hard Rule inlined above still holds (no transaction, no replica-set requirement introduced)
- [ ] lint + vet clean
