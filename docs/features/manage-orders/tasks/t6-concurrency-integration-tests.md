---
id: T6
title: "Write concurrency integration tests for overfill and cross-action races"
layer: "tests"
deps: ["T4", "T5"]
blocks: []
acs: ["AC-05", "AC-13"]
files_hint: ["backend/src/test/java/com/currencyexchange/orderentry/service/OrderConcurrencyIT.java"]
owner: "Marisha"
estimate: "M"
context_budget: "M"
status: "todo"
---

# T6 — Write concurrency integration tests for overfill and cross-action races

## Place in the sequence

- **Blocked by:** T4 — Add fill/amend endpoints (needs the real HTTP/service surface); T5 — Integration-test harness (needs a real MongoDB, not a mock, to demonstrate actual write serialization). **Blocks:** none — last task in the backend chain. **Wave:** 5.
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

> **As a** Trader
> **I want** the system to reject a fill that exceeds what's left on an order, and to never let a double-submitted fill overcount
> **So that** an order's remaining amount is always trustworthy, even when I make a mistake or double-click
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task is the proof that T2/T3's atomic-guard mechanism actually holds under real concurrent load, not just in a mocked unit test.

## Inlined context

> **How verify:** an integration test that fires two concurrent requests (two fills, and a fill racing a cancel) against the same order and asserts exactly one succeeds and the remaining amount is never negative.
>
> — `sad.md §10, QG-1 Concurrency safety, verbatim` · full text: [sad.md](../sad.md)

> AC-05/AC-13 hold by construction: the database itself rejects any update whose action-specific precondition (`status = PENDING`, plus fill's remaining-amount check or amend's range check) no longer holds, no application-level coordination required.
>
> — `adr/0001-atomic-conditional-update-for-order-actions.md §Consequences, Positive, verbatim` · full text: [adr/0001-atomic-conditional-update-for-order-actions.md](../adr/0001-atomic-conditional-update-for-order-actions.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [adr/0001-atomic-conditional-update-for-order-actions.md](../adr/0001-atomic-conditional-update-for-order-actions.md)) and follow it. Do not guess.

## Data delta

No DB changes — this task only exercises the existing atomic-update paths under concurrent load.

## API contract

Exercises the endpoints T4 built: `POST /api/orders/{id}/fills` and `DELETE /api/orders/{id}`, fired concurrently against the same order id.

— `contracts/openapi.yaml, operationIds recordFill / cancelOrder, abridged` · full text: [openapi.yaml](../contracts/openapi.yaml)

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

- [ ] Create `OrderConcurrencyIT` extending `IntegrationTestSupport` (T5) — `backend/src/test/java/com/currencyexchange/orderentry/service/OrderConcurrencyIT.java`
- [ ] Test 1 (AC-05): seed a PENDING order with `remainingAmount = 100`; fire two concurrent `fillOrder` calls of `70` each (combined `140 > 100`); assert exactly one succeeds, the other is rejected with `InvalidFillAmountException`/`409 order.fill_exceeds_remaining`, and the final `remainingAmount` is never negative (`100 - 70 = 30`)
- [ ] Test 2 (AC-13): seed a PENDING order; fire a `fillOrder` and a `cancelOrder` concurrently on the same order; assert exactly one of the two takes effect and the order ends in a consistent terminal/PENDING state (never a fill silently recorded against a CANCELLED order)
- [ ] Use a real thread pool / `CompletableFuture` pair (or the repo's existing concurrency-testing convention if one exists) to fire the two requests genuinely concurrently, not sequentially

## Edge cases

| Case | Behaviour |
|---|---|
| Both fills happen to land in a strict sequence anyway (thread scheduling) | Still valid — the assertion is "exactly one succeeds and remaining never negative," true regardless of interleaving order |
| Fill wins the race against cancel | Fill applies normally (remaining reduced, order stays PENDING or transitions to FILLED); cancel is rejected as no-longer-relevant only if it arrives after — the two orderings are the two valid outcomes to assert, not a fixed expected order |

## Definition of Done

- [ ] `OrderConcurrencyIT` (both tests) passes reliably in `mvn test` (not flaky — run a few times if timing-sensitive)
- [ ] every Hard Rule inlined above still holds (assertion is data-layer atomicity, not a retry/lock at the application level)
- [ ] lint + vet clean
