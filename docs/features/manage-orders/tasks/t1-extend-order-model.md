---
id: T1
title: "Extend Order model with FILLED status, remainingAmount, and embedded FillEvent"
layer: "domain"
deps: []
blocks: ["T2"]
acs: ["AC-11"]
files_hint: ["backend/src/main/java/com/currencyexchange/orderentry/model/Order.java", "backend/src/main/java/com/currencyexchange/orderentry/model/OrderStatus.java", "backend/src/main/java/com/currencyexchange/orderentry/model/FillEvent.java"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T1 — Extend Order model with FILLED status, remainingAmount, and embedded FillEvent

## Place in the sequence

- **Blocked by:** none — first task in the backend chain. **Blocks:** T2 — atomic conditional update helpers need the new fields to guard/mutate. **Wave:** 1 (can start immediately, in parallel with T5 and the whole T7–T8 frontend branch).
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

> **As a** Trader
> **I want** to see the individual fills recorded against an order
> **So that** I can trust how its remaining amount was derived
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task lays the storage shape (`remainingAmount`, embedded `fillEvents`, `FILLED` status) that every later fill/cancel/amend task and the fill-trail UI build on.

## Inlined context

> store every amount-bearing field (`Order.amount`, `Order.remainingAmount`, `FillEvent.amount`) as `BigDecimal` normalized to a **fixed scale of 8** (`setScale(8, RoundingMode.HALF_UP)`) on write, applied uniformly in `OrderService` before persisting. Because every write lands on the same fixed scale, `remainingAmount.subtract(fillAmount)` is exact — no binary floating-point drift is possible, so the `PENDING → FILLED` transition can test `remainingAmount.compareTo(BigDecimal.ZERO) == 0` directly, with no epsilon/near-zero heuristic needed.
>
> — `data-model.md §Open decisions resolved here, decision 3, verbatim` · full text: [data-model.md](../data-model.md)

> `FillEvent` has no `id` field — just `amount` + `timestamp`. Fills are permanent and never individually referenced, corrected, or reversed (spec §3 non-goals); AC-08 only ever renders the full ordered trail, never a single fill by id.
>
> — `data-model.md §Open decisions resolved here, decision 2, verbatim` · full text: [data-model.md](../data-model.md)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `remainingAmount` | `BigDecimal`, scale 8 | **nullable** — `null` on any order created before this feature (AC-11); `0 < value <= amount` while `PENDING` | **new.** Never `null` for an order created after this feature ships |
| `status` | `OrderStatus` enum (`PENDING`/`CANCELLED`/**`FILLED`** new) | NOT NULL | `FILLED` value added to the existing enum |
| `fillEvents` | `List<FillEvent>`, embedded | append-only; oldest-first insertion order preserved (AC-08) | **new.** Defaults to empty list; absent on any pre-feature order (treated as empty) |

— `data-model.md §Entities, table Order, abridged` · full text: [data-model.md](../data-model.md)

**Hard rule:** No migration files staged for this feature — new fields are additive and need no DDL under Mongo's schemaless model.

— `data-model.md §Open decisions resolved here, decision 1, verbatim` · full text: [data-model.md](../data-model.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) ·
[openapi.yaml](../contracts/openapi.yaml) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

| Field | Type | Constraints | Change |
|---|---|---|---|
| `triggerPrice` | `BigDecimal`, scale 8 | `> 0` | altered (scale fixed to 8; existing values re-normalized lazily on next write) |
| `amount` | `BigDecimal`, scale 8 | `> 0`, immutable after create | altered (scale fixed to 8) |
| `remainingAmount` | `BigDecimal`, scale 8 | nullable, `0 < value <= amount` while PENDING | added |
| `status` | enum | `PENDING`/`CANCELLED`/`FILLED` | altered (new value `FILLED`) |
| `fillEvents` | `List<FillEvent>` embedded | append-only | added |
| `FillEvent.amount` | `BigDecimal`, scale 8 | `> 0` | new type |
| `FillEvent.timestamp` | `Instant` | NOT NULL, server-set | new type |

— `data-model.md §Entities, tables Order and FillEvent, abridged` · full text: [data-model.md](../data-model.md)

No migration file — Mongo is schemaless and Spring Data maps POJOs directly.

## API contract

Internal — no API surface. This task only changes the persisted document shape; the endpoints that read/write it are T3 (service) and T4 (controller).

## Acceptance criteria

### AC-11 — domain invariant

> **Given** a PENDING order created before this feature existed, with no remaining amount ever recorded for it
> **When** the Trader views it or acts on it
> **Then** the system treats its remaining amount as equal to its original amount, as if zero fill events had been recorded
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

Note: this task only makes `remainingAmount` nullable and `fillEvents` absent-safe in the model so the fallback is representable; the fallback computation itself (`effectiveRemaining`) is implemented in T3.

## Checklist

- [ ] Add `FILLED` to `OrderStatus` enum — `backend/src/main/java/com/currencyexchange/orderentry/model/OrderStatus.java`
- [ ] Create `FillEvent` (fields: `amount` `BigDecimal`, `timestamp` `Instant`; no `id`) — `backend/src/main/java/com/currencyexchange/orderentry/model/FillEvent.java`
- [ ] Add `remainingAmount` (`BigDecimal`, nullable) and `fillEvents` (`List<FillEvent>`, defaults to empty list) to `Order` — `backend/src/main/java/com/currencyexchange/orderentry/model/Order.java`
- [ ] Set `triggerPrice`/`amount` to scale 8 on write in the existing create path (`OrderService.createOrder`) and set `remainingAmount = amount` at creation — `backend/src/main/java/com/currencyexchange/orderentry/service/OrderService.java`
- [ ] Confirm `mvn test` still passes with no changes to `OrderServiceTest`

## Edge cases

| Case | Behaviour |
|---|---|
| Pre-feature `Order` document with no `remainingAmount` field at all | Deserializes with `remainingAmount == null`, `fillEvents == null`/empty — both must be handled as valid states, not errors |
| A `BigDecimal` amount supplied with more than 8 decimal places on create | Normalized via `setScale(8, RoundingMode.HALF_UP)` before persisting |

## Definition of Done

- [ ] `Order`, `OrderStatus`, `FillEvent` compile with the new fields
- [ ] `mvn test` passes with the existing `OrderServiceTest` unmodified
- [ ] every Hard Rule inlined above still holds (no migration file added)
- [ ] lint + vet clean (`mvn compile` clean)
