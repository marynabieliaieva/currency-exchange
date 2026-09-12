---
status: Draft
owner: "Marisha"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-12"
feature_size: "S"
target_surfaces: [backend-service, web-frontend]
---

# Software Architecture Document — manage-orders

## 1. Introduction and goals

**Intent.** manage-orders gives the Trader a dedicated Manage Orders screen to Cancel, Fill, or Amend any pending order, plus a visible per-order fill trail — so every action that today requires a manual database edit becomes a UI action, and every order's remaining amount is always explainable from what's on screen. The order entry page becomes creation-only once this screen exists.

**Top-3 quality goals (1-liners; full scenarios in §10):**

1. Concurrency safety — no two actions (fill/cancel/amend) on the same order ever apply in a way that leaves it inconsistent, even when submitted at nearly the same time.
2. Traceability of derived state — every fill, full or partial, is individually visible so the Trader can always explain how an order's remaining amount was derived.
3. Zero-manual-edit completeness — the Trader can cancel, fill, or amend any pending order entirely from the UI, with each action usable within the Trader's own informal sub-30-second expectation.

**Stakeholders.**

| Role | Interest | Sign-off owner? |
|---|---|---|
| Trader | Uses Manage Orders and the entry screen daily; the sole actor and sole consumer of both | No |
| Tech Lead | SAD approval | Yes |
| Security Lead | Confirms no new authz/data-exposure surface is introduced (spec §6.1: none) | No |

## 2. Constraints

**Technical.**
- Java 21, Spring Boot, Maven — `backend/`.
- MongoDB (project runs 6.0.27 for local Windows compatibility; standalone single-node — no replica set, no multi-document transactions available).
- TypeScript, React, Vite — `frontend/`.
- Layered architecture convention (from the existing order-entry code): `model/` → `repository/` → `service/` → `controller/`, thin controllers, `OrderService` as the sole repository access point, bean-validated DTOs, uniform `ApiError` JSON via `GlobalExceptionHandler`.

**Organisational.**
- No hard deadline or effort budget stated in the spec; feature classified size S.
- Team: solo (Marisha).

**Conventions.**
- Extends the existing `com.currencyexchange.orderentry` package — no new backend module (see ADR-0001, ADR-0002 for the decisions that did cross the blast-radius gate).
- New DTOs follow `CreateOrderRequest`'s bean-validation pattern (`@Positive` etc.).
- New domain exceptions follow `OrderNotFoundException`'s pattern, handled by extending `GlobalExceptionHandler`.

**Regulatory / external.**
- N/A — internal single-user tool, no new personal-data fields, no compliance driver (spec §6.1).
- Inherited from the spec's own decision override: no authorization/ownership model is introduced by this feature (spec §1) — carried here as a fixed constraint, not re-opened by this design pass.

## 3. Context and scope

The single Trader manages currency-exchange orders end to end: creating them on the order entry page, then acting on them (cancel/fill/amend) and reviewing their fill trail on the Manage Orders screen. No external system participates — there is no execution engine, no market-data feed, and no identity provider; MongoDB is the system's only dependency.

<!-- brownfield: layered Spring Boot backend (model/repository/service/controller, Mongo-backed, no @Version/findAndModify/transactions in use today) + a router-less single-page React frontend, scanned directly for this pass (no docs/architecture-map.md exists yet — recommend running `/sdd:survey` to persist one). -->

**External systems (in / out):**

| Actor or system | Type | Interaction |
|---|---|---|
| Trader | Person | Creates, cancels, fills, and amends orders; views each order's fill trail |
| MongoDB | System (internal datastore) | Persists orders, including each order's embedded fill-event history |

**C4 Context (L1):**

```mermaid
C4Context
    title manage-orders — System Context

    Person(trader, "Trader", "creates, cancels, fills, and amends orders")

    System(app, "Currency Exchange Order System", "order entry + order management for Take Profit / Stop Loss orders")
    SystemDb(db, "MongoDB", "stores orders and their fill events")

    Rel(trader, app, "Creates, cancels, fills, amends orders; views fill trail", "HTTPS")
    Rel(app, db, "Reads/writes orders and fill events", "Mongo driver")
```

The Trader is the only actor and talks to one system, which in turn depends on MongoDB as its sole datastore — no other system is involved in this feature.

## 4. Solution strategy

**Top strategic choices (the seeds for ADRs):**

1. **Continue the existing two-surface split** (`backend-service` + `web-frontend`) — manage-orders extends the surfaces order-entry already established rather than introducing a new one; no new module or deployment unit.
2. **Atomic conditional update over an embedded fill-events array** (ADR-0001) — cancel/fill/amend are each a single guarded MongoDB write (`status = PENDING` + a sufficient-remaining-amount condition) that also appends the fill event in the same atomic document write. Chosen over optimistic-locking retries or an in-process lock because it satisfies the AC-05/AC-13 concurrency NFR directly at the data layer, with no retry logic and no multi-instance failure mode.
3. **Introduce react-router for screen navigation** (ADR-0002) — `App.tsx` becomes a thin router shell with two routes so the entry page and Manage Orders each get their own URL (AC-15), replacing the current router-less single page. Chosen over hand-rolled History-API routing or separate Vite multi-page bundles as the standard, least-surprising way to give a two-screen SPA real navigation.
4. **No caching tier** — nothing in the app caches today; this feature introduces none.

Each tactical decision in later sections traces to one of these seeds.

## 5. Building block view

The backend stays a single layered Spring Boot module (model → repository → service → controller), extended in place rather than split — cancel/fill/amend are new operations on the existing `Order` aggregate, not a new bounded context. The frontend gains a thin routing layer (ADR-0002) splitting the existing single page into two routed screens that share the existing API client and type definitions.

**Internal decomposition:**

```
backend/src/main/java/com/currencyexchange/orderentry/
├── model/       Order (extended: FILLED status, remainingAmount, embedded fillEvents[]), OrderStatus, FillEvent
├── repository/  OrderRepository (existing MongoRepository<Order,String>) + OrderMongoOperations (new: MongoTemplate-based atomic update helpers, ADR-0001)
├── service/     OrderService (extended: guarded cancelOrder, new fillOrder, new amendOrder)
├── controller/  OrderController (extended: POST /api/orders/{id}/fill, PATCH /api/orders/{id}; existing DELETE for cancel)
├── dto/         FillRequest, AmendRequest (new); CreateOrderRequest, ApiError (existing)
└── exception/   OrderNotOpenException, InvalidFillAmountException, InvalidAmendException (new) + GlobalExceptionHandler (extended)

frontend/src/
├── App.tsx          thin router shell (ADR-0002): routes "/" and "/manage-orders"
├── pages/           OrderEntryPage (creation-only, AC-09), ManageOrdersPage (new)
├── components/      OrderEntryForm (existing, unchanged), ManageOrdersList (new), CancelDialog / CancelForfeitureDialog / FillDialog / AmendDialog (new), FillTrail (new, inline row expansion)
├── api/orderApi.ts  extended: fillOrder(id, amount), amendOrder(id, {price?, remainingAmount?})
└── types/order.ts   extended: FILLED status, remainingAmount, FillEvent
```

**C4 Container (L2):**

```mermaid
C4Container
    title manage-orders — Containers

    Person(trader, "Trader")

    Container_Boundary(app, "Currency Exchange Order System") {
        Container(web, "Order Web App", "React + Vite SPA", "order entry page and Manage Orders screen, routed via react-router")
        Container(api, "Order API", "Spring Boot / Java 21", "REST endpoints for create/list/cancel/fill/amend")
    }

    ContainerDb(db, "MongoDB", "Document store", "orders, each with an embedded fill-events array")

    Rel(trader, web, "Uses", "HTTPS")
    Rel(web, api, "Calls", "JSON/HTTPS")
    Rel(api, db, "Reads/writes with atomic conditional updates", "Mongo driver")
```

Two containers make up the system: the Order Web App (now internally routed between the two screens) and the Order API, which is the only thing that talks to MongoDB, always through the atomic conditional updates ADR-0001 establishes.

## 6. Runtime view

**Critical flow 1: Record a fill, guarded against overfill and races (AC-03, AC-04, AC-05)**

```mermaid
sequenceDiagram
    actor Trader
    participant Web as Order Web App
    participant API as Order API
    participant DB as MongoDB

    Trader->>Web: submits a fill amount for a PENDING order
    Web->>API: requests the fill
    API->>DB: atomic conditional update (status=PENDING, remaining >= amount)
    alt condition holds
        DB-->>API: updated order (remaining reduced, fill event appended)
        API-->>Web: fill recorded, new remaining amount
        Web-->>Trader: confirmation (and FILLED status if remaining reached zero)
    else condition fails (already exceeds remaining, or order no longer PENDING)
        DB-->>API: no matching document
        API-->>Web: rejection with the reason
        Web-->>Trader: inline rejection, remaining amount unchanged
    end
```

**Critical flow 2: Cancel an order that already has fills (AC-02)**

```mermaid
sequenceDiagram
    actor Trader
    participant Web as Order Web App
    participant API as Order API
    participant DB as MongoDB

    Trader->>Web: requests cancel on an order with recorded fills
    Web->>API: asks how much is already filled
    API->>DB: reads the order's fill events
    DB-->>API: fill total
    API-->>Web: amount that would be forfeited
    Web-->>Trader: forfeiture confirmation dialog
    Trader->>Web: confirms forfeiture
    Web->>API: confirms the cancel
    API->>DB: atomic conditional update (status=PENDING → CANCELLED, remaining amount left unchanged)
    DB-->>API: updated order
    API-->>Web: cancelled
    Web-->>Trader: confirmation
```

The `sequences` stage covers the remaining §5 acceptance criteria (amend, the fill-trail expansion, and the closed-order race guard) as further flows against these same two containers.

## 7. Deployment view

<!-- N/A: reuses the existing deployment unit — same Spring Boot jar, same Vite static build, same single MongoDB instance; no new service, process, or infrastructure is introduced by this feature. -->

## 8. Crosscutting concepts

| Concept | Convention | Where defined |
|---|---|---|
| Logging | Repo's existing Spring Boot default logging, no feature-specific change | Existing config |
| Authentication | None — no accounts or sessions exist anywhere in the app; unchanged by this feature | Spec §1 decision override, §6.1 |
| Error handling | Domain exceptions (`OrderNotOpenException`, `InvalidFillAmountException`, `InvalidAmendException`) → `GlobalExceptionHandler` → uniform `ApiError` JSON, same pattern as `OrderNotFoundException` | `exception/GlobalExceptionHandler` |
| ID strategy | MongoDB's default generated `String` id, unchanged | `model/Order` |
| Internationalisation | N/A — single language | — |
| Observability | None beyond default Spring Boot logs; no metrics/tracing exist today | — |
| Events | N/A — no event system in this app | — |
| Concurrency guard | Atomic conditional MongoDB update per action (ADR-0001) — the mechanism, not a separate pattern, is the crosscutting concept here | ADR-0001 |

## 9. Architecture decisions

| # | Title | Status | Section |
|---|---|---|---|
| 0001 | Use an atomic conditional update over an embedded fill-events array for order actions | Accepted | §4, §5 |
| 0002 | Introduce react-router for order-entry / manage-orders navigation | Accepted | §4, §5 |

ADR files live under `docs/features/manage-orders/adr/`.

## 10. Quality requirements

**QG-1. Concurrency safety**
- **When:** two of {fill, cancel, amend} are submitted for the same order at nearly the same time (including two overlapping fills whose combined amount exceeds what's remaining).
- **Then:** the system processes them one at a time; whichever would leave the remaining amount negative, or would apply to an order that's no longer PENDING, is rejected in full — never partially applied — so the order's remaining amount never goes below zero and never changes after it closes (spec §6 NFR: "no two actions ... ever apply concurrently in a way that leaves it inconsistent").
- **How verify:** an integration test that fires two concurrent requests (two fills, and a fill racing a cancel) against the same order and asserts exactly one succeeds and the remaining amount is never negative.

**QG-2. Traceability of derived state**
- **When:** any fill is recorded against an order, full or partial.
- **Then:** a fill event (amount + timestamp) is stored and later shown, oldest first, when the order's row is expanded (AC-08); the order's remaining amount always equals what the recorded fill events plus any amends imply.
- **How verify:** a unit test on the fill/amend arithmetic plus an e2e-through-UI test that records two partial fills and confirms both appear in the expanded trail in order.

**QG-3. Zero-manual-edit completeness**
- **When:** the Trader performs a cancel, fill, or amend from the Manage Orders screen.
- **Then:** the action completes entirely through the UI with no database edit, reflected immediately in the order's row.
- **How verify:** manual QA against the KPI target ("under 30 seconds per action," spec §7) plus AC coverage via an e2e-through-UI test per action.

## 11. Risks and technical debt

| Risk / debt | Severity | Mitigation | Owner |
|---|---|---|---|
| Legacy PENDING orders created before this feature have no remaining amount ever recorded (AC-11) | Medium | Service read path treats a missing remaining amount as equal to the order's original amount — a computed fallback, not a backfill migration | Marisha |
| Decimal rounding across multiple partial fills could leave a "phantom pending" (a near-zero-but-not-exactly-zero remaining amount that never auto-transitions to FILLED) | Open question | Resolve before `sdd:data-model` — pick a rounding-safe representation (e.g. a fixed-scale `BigDecimal` with an explicit near-zero check) | Marisha |
| No `docs/architecture-map.md` exists for this repo yet — this pass scanned the code directly | Low | Run `/sdd:survey` to persist a reusable map for future features | Marisha |
| `Order` documents grow with every fill event (ADR-0001's embedded-array shape) | Low | Acceptable at this feature's expected order/fill volume; revisit (separate `FillEvent` collection) only if fill counts per order grow large | Marisha |

**Accepted debt (acceptable in v1, plan to fix later):**
- No amend-history or audit trail — only an order's current state is visible, not a log of past amendments (spec §3 non-goal).
- No correction or reversal path for a wrongly-recorded fill or cancel — both are permanent once recorded (spec §3 non-goal; spec §8 open question tracks revisiting this).
- No latency/throughput/availability SLOs are tracked — this is a personal, single-local-user tool today (spec §6, spec §8 open question).
- No authorization/ownership model — matches the app's existing single-Trader scope (spec §1 decision override, spec §8 open question tracks revisiting this if ever deployed beyond personal use).

## 12. Glossary

| Term | Meaning |
|---|---|
| Amend | Editing a pending order's trigger price and/or remaining amount in place. Not cancel-and-recreate — the order keeps its identity and any existing fill history. |
| Fill | A manually recorded confirmation that some or all of an order's amount was executed. Not an automated match against a price feed. |
| Fill event | One timestamped record of a single fill against an order (amount + when). An order can have many fill events. |
| Remaining amount | The order's currently unfilled amount — normally original amount minus the sum of its fill events, but an amend can set it directly, after which it is the authoritative current value. Not the order's original amount, which stays fixed once created. |
| Trader | The single person who places, cancels, fills, and amends orders in this app. Not a role distinct from the app's owner/operator — there is exactly one, with no separate accounts. |
| Atomic conditional update | A single database write that only applies when a stated precondition (e.g. `status = PENDING` and enough remaining amount) still holds at write time — the mechanism ADR-0001 uses to make concurrent actions safe. |
