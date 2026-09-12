---
status: Accepted
owner: "Marisha"
reviewers: []
updated_at: "2026-09-12"
feature_size: "S"
ticket: "manage-orders"
---

# 0001 — Use an atomic conditional update over an embedded fill-events array for order actions

- **Status:** Accepted
- **Date:** 2026-09-12
- **Deciders:** Marisha (Architect), during the `design` Socratic walk

## Context

manage-orders adds Cancel/Fill/Amend actions on top of the existing `Order` document (currently `PENDING`/`CANCELLED` only, no fill concept). AC-05 and AC-13 require that concurrent actions on the same order can never leave it inconsistent — e.g. two overlapping fills must never both succeed past what's remaining, and a fill racing a concurrent cancel must never be silently recorded against a closed order. The current codebase has no optimistic locking (`@Version`), no `MongoTemplate`/`findAndModify` usage, and no transactions anywhere (confirmed by a repo scan) — this decision has to be made from scratch, and it fixes both the concurrency mechanism and the shape of fill-event storage at once.

## Decision drivers

- Concurrency-safety NFR (spec §6): "no two actions (fill/cancel/amend) on the same order ever apply concurrently in a way that leaves it inconsistent," measured as "atomic conditional update at the data layer" (AC-05, AC-13).
- AC-08: fill events must be individually visible (amount + timestamp, oldest first) per order.
- The repo's MongoDB instance (per project setup) is a standalone single-node deployment — multi-document ACID transactions require a replica set, which isn't part of this stack today, so any option needing transactions carries extra ops cost this feature shouldn't force.

## Considered options

1. **Atomic conditional update over an embedded array** — a single `findOneAndUpdate` guards on `status = PENDING` and a sufficient remaining amount, and in the same atomic document write decrements `remainingAmount` and pushes the new fill event into an embedded `fillEvents` array on the `Order` document.
2. **Optimistic locking (`@Version`) with a retry loop** — add a `@Version` field to `Order`; a losing concurrent write throws `OptimisticLockingFailureException` and the service re-reads, re-validates, and retries the write.
3. **In-process lock per order id** — guard each order's mutations with an in-memory lock (e.g. a `ConcurrentHashMap<String, Lock>` keyed by order id) inside the single running backend instance.

## Decision outcome

**Chosen:** Option 1. It satisfies the concurrency NFR directly at the data layer (the spec's own measurement) with a single round-trip and no retry logic to get wrong, and embedding fill events keeps the guard-and-mutate step atomic in one document write — no multi-document transaction (and therefore no replica-set requirement) is needed. Option 2 adds a retry loop for no benefit over option 1 here. Option 3's actual weakness isn't multi-instance deployment (this app runs, and is expected to keep running, as a single instance) — it's that an in-process lock lives entirely in application memory and enforces nothing against a write that reaches MongoDB by any other path (a direct script, a future admin tool, a second process started by mistake). That's the same category of exposure already accepted elsewhere in this feature for the no-authorization decision, but here it's avoidable at no extra cost by putting the guard in the data layer instead.

Fill, cancel, and amend each guard a different condition through this same mechanism, not a single shared precondition: fill's guard is `status = PENDING` AND `effectiveRemaining >= amount` (falling back to the order's original amount when `remainingAmount` was never recorded, so a legacy pre-feature order — AC-11 — is guarded exactly as if it had an explicit remaining amount equal to its original one); cancel's guard is only `status = PENDING`; amend's guard is `status = PENDING` AND the requested value staying inside the allowed range. Only fill mutates `remainingAmount` and appends a fill event as part of its write. When a guard fails, the service issues a plain read of the current order to distinguish *why* — already closed vs. amount out of range — rather than surfacing one generic rejection for every failure.

## Consequences

**Positive**
- AC-05/AC-13 hold by construction: the database itself rejects any update whose action-specific precondition (`status = PENDING`, plus fill's remaining-amount check or amend's range check) no longer holds, no application-level coordination required.
- Fill's atomic write covers "reduce remaining amount" + "append fill event" + "flip to FILLED at zero" together — no partial-update window.
- No new infrastructure (no replica set, no transactions, no external lock service).

**Negative**
- `Order` documents grow with every fill; for this feature's expected order lifetime and fill counts this is a non-issue, but it isn't a design that scales indefinitely to very high fill counts on one order.
- The query/update logic is a hand-written Mongo condition rather than an ORM-level abstraction — slightly more Mongo-specific code than a repository method call.

**Neutral**
- Migrating later to a separate `FillEvent` collection is possible (e.g. if fill volume per order grows large) but needs a data migration; not expected to be needed at this feature's scale.

## Links

- Spec: [[../spec.md]] — AC-03, AC-04, AC-05, AC-08, AC-13, §6 NFR
- SAD: [[../sad.md]] §4, §5
- Related ADR: none
