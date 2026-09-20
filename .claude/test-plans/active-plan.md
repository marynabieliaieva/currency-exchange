# Active Test Plan — manage-orders

> **Strategist pass 4** — supersedes the pass-3 plan in its entirety. The pass-3 plan was never acted
> on (no `decisions.json` was ever produced, and its `review.html` is not on disk), so nothing in it
> was implemented and nothing here is a continuation of it.
>
> **Status of this document:** scenarios below are **PROPOSED, pending review**. They are written into
> `.claude/test-plans/review.html` for accept/decline. **No downstream agent may start any scenario
> until `.claude/test-plans/decisions.json` exists and §6 / §7 of this file have been re-synced
> against it.** Section §6 (Declined) is the hard prohibition list and is empty only because the
> review has not happened yet.

| | |
|---|---|
| Feature | `manage-orders` (branch `feature/manage-orders`) |
| Strategist pass | 4 — 2026-09-13 |
| Source of truth for tiers/techniques | `.claude/rules/test-strategy.md` |
| Review UI | `.claude/test-plans/review.html` (rendered from `review-template.html`, 30 scenarios) |
| Decision ingestion | `.claude/test-plans/decisions.json` — **not yet present** |
| Agent memory consulted | `.claude/agent-memory/test-strategist/MEMORY.md` |

---

## 1. Context & scope

`manage-orders` extends the base order-entry module (create / list / cancel, `PENDING → CANCELLED`)
with a dedicated Manage Orders screen and three lifecycle actions — **cancel**, **fill** (full or
partial, with a visible per-order fill trail) and **amend** (trigger price and/or remaining amount) —
plus a `FILLED` terminal state and React Router navigation between the entry and manage screens.

Acceptance criteria AC-01 … AC-15 live in `docs/features/manage-orders/spec.md` §5. The concurrency
mechanism is `ADR-0001` (atomic conditional update — one guarded `findOneAndUpdate` per action, so
MongoDB itself serializes racing actions with no read-then-write window). Navigation is `ADR-0002`.

### 1.1 Verified baseline — re-derived this pass, not inherited

Every claim below was re-read from the working tree on 2026-09-13 during pass 4.

**What changed since the pass-3 plan (written 2026-09-13 17:37):**

- **No production or test file changed.** Nothing under `backend/src`, `frontend/src` or
  `docs/features/manage-orders/` has a modification time after 16:00 on 2026-09-13, and the last
  commit is `5233130` (2026-09-13 11:47). The pass-3 technical findings therefore still hold; they
  have been independently re-verified here rather than copied forward.
- **The review tooling changed.** `review-template.html` (18:35), `.claude/hooks/decisions-server.py`,
  `open-review.sh`, `on-review-completed.sh`, and `.claude/agents/test-strategist.md` (18:39) are all
  newer than the pass-3 plan. The protocol moved from *"paste the decisions JSON into chat"* to
  *"the page POSTs to a local server which writes `decisions.json`"*. This plan targets the new flow.
- **`review.html` was absent from disk** at the start of this pass — only `active-plan.md` and
  `review-template.html` were present in `.claude/test-plans/`. It has now been regenerated.
- **Scenario count changed 30 → 30, but the set is not identical.** Pass 3 proposed 30 with 28
  rendered; this pass proposes 30 with **all 30 rendered**, and the differences are listed in §9.

**Uncommitted working-tree state at planning time** (8 files, all consistent with what `MEMORY.md`
records as approved in pass 3 — do not re-litigate):

- `frontend/src/components/*.tsx` (7 files) — `data-testid` attributes added to every component.
  This was an approved §7 production-code exception. Component tests still use **role/label**
  selectors; `data-testid` is reserved for the future Playwright tier (settled — `MEMORY.md`).
- `docs/features/manage-orders/contracts/openapi.yaml` — the `POST /{id}/fills` `400` description now
  documents that the error is raised by `OrderService` post-normalization rather than by DTO bean
  validation. **Settled; not contract drift.**

### 1.2 Production files under test — NEVER modify (rules §7)

```
backend/src/main/java/com/currencyexchange/orderentry/
  service/OrderService.java                    createOrder, listOrders, getOrder,
                                               cancelOrder, fillOrder, amendOrder, normalize(scale 8, HALF_UP)
  repository/OrderMongoOperations.java         tryCancel / tryFill / tryAmend — guarded findOneAndUpdate
  repository/OrderRepository.java              MongoRepository + findAllByOrderByCreatedAtDesc
  controller/OrderController.java              POST /api/orders, GET /api/orders, GET+DELETE+PATCH /{id},
                                               POST /{id}/fills
  exception/GlobalExceptionHandler.java        400/404/409 + ApiError.code mapping
  dto/{CreateOrderRequest,AmendRequest,FillRequest,ApiError}.java
  model/{Order,FillEvent,OrderStatus,OrderSide,OrderType}.java

frontend/src/
  api/orderApi.ts                              fetch wrapper + ApiRequestError + handleResponse
  types/order.ts                               hand-synced mirror of the Java DTOs (no codegen)
  pages/{ManageOrdersPage,OrderEntryPage}.tsx
  components/{ManageOrdersList,FillTrail,CancelDialog,CancelForfeitureDialog,FillDialog,
              AmendDialog,OrderEntryForm}.tsx
  AppRoutes.tsx
```

Test agents create/modify/delete files under `backend/src/test/**` and `frontend/src/**/*.test.tsx`
(plus new test-only helpers) **only**. Any scenario that cannot be implemented without touching the
files above must be marked **blocked** in this file and escalated (see §8) — never silently fixed,
never silently reassigned.

### 1.3 Existing test files — extend in place, never duplicate

| File | Tier | Tests | Notes |
|---|---|---|---|
| `backend/.../service/OrderServiceTest.java` | BE unit | 21 | Mockito, both collaborators mocked. The only true BE-unit file. |
| `backend/.../controller/OrderControllerTest.java` | BE component | 14 | `@WebMvcTest(OrderController.class)` + `@MockBean OrderService`. |
| `backend/.../repository/OrderMongoOperationsIntegrationTest.java` | Integration | 13 | Real embedded Mongo. Owned by `@integration-tester` despite its `repository/` path and name. |
| `backend/.../repository/OrderRepositoryIntegrationTest.java` | Integration | 1 | Spring Data round-trip — see INT-09. |
| `backend/.../service/OrderConcurrencyIT.java` | Integration | 3 | Real races via `ExecutorService` + `CompletableFuture`. |
| `backend/.../service/OrderServiceLegacyDocumentIT.java` | Integration | 2 | Hand-built raw `Document` with fields absent. |
| `backend/.../IntegrationTestSupport.java` | Integration harness | — | Bare `@SpringBootTest`. **No cleanup of any kind.** |
| `frontend/src/pages/ManageOrdersPage.test.tsx` | UI component | 12 | `vi.mock("../api/orderApi", importOriginal)`; role/label selectors. |
| `frontend/src/pages/OrderEntryPage.test.tsx` | UI component | 2 | Happy path only. |
| `frontend/src/App.test.tsx` | UI component | 4 | Router/AC-15. |

**Zero coverage today:** `frontend/src/api/orderApi.ts`, and every component under
`frontend/src/components/` in isolation (all seven are exercised only transitively through a page).

### 1.4 Risk classification (rules §1 — risk-based coverage thresholds)

| ID | Path | Class | Why |
|---|---|---|---|
| C1 | Cancel-with-forfeiture confirmation (AC-02) | **CRITICAL** | Irreversible loss of the unfilled remainder. Exhaustive state-transition coverage required. |
| C2 | Concurrency / atomic conditional update (AC-05, AC-13, ADR-0001) | **CRITICAL** | 100% of the action-pair matrix required. `amend` currently appears in **no** race test. |
| C3 | Amount normalization, scale-8 rounding, fill/amend boundaries (AC-03, AC-04, AC-07, AC-12) | **CRITICAL** | Monetary BVA per rules §3.2. Three amount-bearing entry points with three different positivity-vs-normalization orderings. |
| C4 | Legacy-document fallback (AC-11) | **CRITICAL** | Silent wrong-remaining-amount is a money defect; the fallback sits on every read path. |
| S1 | Listing, routing, expand/collapse, empty/loading/error states | Standard | EP/BVA, no fixed percentage target. |

---

## 2. Architecture & testability notes

### 2.1 Backend dependency-injection seams

`OrderService` takes `OrderRepository` + `OrderMongoOperations` through its constructor — both
mockable with no framework. `OrderMongoOperations` takes `MongoTemplate` and is instantiated directly
in integration tests (`new OrderMongoOperations(mongoTemplate)`). `OrderController` takes
`OrderService`. There is no static state, no field injection and no hidden singleton anywhere in the
module — every tier is reachable without a production change.

### 2.2 `OrderMongoOperations` has **no BE-component tier** — deliberate, settled

Recorded in `MEMORY.md`; **do not propose one**. The logic under test *is* MongoDB query language
(`$expr` / `$toDecimal` guards, `$reduce` over `fillEvents`, an update-with-aggregation pipeline).
Mocking the driver would assert that we built the `Document` we built — a tautology with zero mutation
value, i.e. exactly the coverage padding rules §1 forbids. It is covered at the **Integration tier
only**, and `@integration-tester` owns `OrderMongoOperationsIntegrationTest`.

### 2.3 Integration substrate: embedded Flapdoodle, not Testcontainers

`IntegrationTestSupport` is a bare `@SpringBootTest`. `de.flapdoodle.embed.mongo.spring3x` 4.33.0 is
on the test classpath and `backend/src/test/resources/application.yml` pins
`de.flapdoodle.mongodb.embedded.version: 6.0.27`, so Spring Boot auto-configures a **real ephemeral
`mongod` process** — no Docker daemon and no locally running MongoDB required.

This is a real database, not a mock, so it satisfies the intent of rules §2.6; it is **not** a
container. Noted as a deviation for `@test-reviewer`'s awareness — not a scenario, and **not** to be
"fixed" by swapping in Testcontainers without an explicit decision.

### 2.4 State isolation — the one real harness defect

**No integration test class drops, truncates or clears the `orders` collection.** There is no
`@BeforeEach`, no `@AfterEach`, no `@DirtiesContext` anywhere. All 19 existing integration tests share
one collection across one Spring context for the whole run, and they pass only because each queries
strictly by its own freshly-seeded `_id`.

Consequence: **any list-level or ordering assertion is unsafe today** — it would read other classes'
leftovers, with an outcome that depends on JUnit's class execution order. `INT-01` fixes this and
**blocks `INT-07`**.

### 2.5 Storage convention — why `$toDecimal` is everywhere

`BigDecimal` fields (`amount`, `remainingAmount`, `FillEvent.amount`) persist as **plain BSON
strings** — Spring Data's default conversion; no `MongoCustomConversions` is registered anywhere in
the repo. Every guard and computation in `OrderMongoOperations` therefore wraps its operands in
`$toDecimal` / `$toString` so comparisons read the document's own live field at write time rather
than a client-side snapshot. Integration tests asserting raw document shape must expect **strings**.

### 2.6 The amend ceiling is *not* the current remaining amount

`amendCeiling()` = `amount − Σ fillEvents.amount`, **not** `remainingAmount`. This is intentional
(AC-07 / AC-12): `remainingAmount` also shrinks on a downward amend, which would make the allowed
range collapse monotonically across successive amends. `OrderService.amendOrder`'s rejection message
recomputes the same quantity in Java. Any amend scenario must use the ceiling definition above.

### 2.7 Positivity-vs-normalization ordering is **not uniform** (settled — `MEMORY.md`)

Three amount-bearing entry points, three different orderings. Enumerate by *whether a value reaches
`normalize()`*, not by whether a positivity check is visible:

| Method | Ordering | Verdict | Effect of a sub-scale positive input (e.g. `0.000000001`) |
|---|---|---|---|
| `fillOrder` | normalize → check | correct | `400 order.invalid_fill_amount` |
| `amendOrder` | check → normalize | defect | `409 order.amend_out_of_range`, misleading ceiling in the message |
| `createOrder` | normalize, **never checks** | worse defect | a `PENDING` order with `amount = remainingAmount = 0` — unfillable, can never reach `FILLED` |

`CreateOrderRequest.amount` carries `@DecimalMin("0.0", exclusive)`, which **passes** any sub-scale
positive, so bean validation is not the backstop it appears to be. `BEU-01` and `BEU-02` **pin** this
behaviour; they must not assert the desired behaviour, which would require an unapproved production
change (see §8, E-01/E-02).

### 2.8 `FillRequest` carries only `@NotNull`, never `@DecimalMin` (settled — `MEMORY.md`)

Bean validation would intercept before `OrderService` runs, and `GlobalExceptionHandler.handleValidation`
never sets `ApiError.code`, so the documented `order.invalid_fill_amount` would silently disappear;
and only a post-normalization check catches a sub-scale positive at all. `openapi.yaml` documents the
service-raised 400. **Do not re-flag this as contract drift.** `BEC-01` tests the boundary it creates.

### 2.9 Frontend test harness

Vitest 2.1 + jsdom + Testing Library (`@testing-library/react` 16, `user-event` 14, `jest-dom` 7),
setup file `frontend/src/test/setup.ts`. **No MSW.** The established boundary mock is
`vi.mock("../api/orderApi", async (importOriginal) => ({ ...actual, fn: vi.fn() }))`, which keeps
`ApiRequestError` real while stubbing the transport — follow it; do not introduce MSW for this pass.

`orderApi.ts` unit tests (UIU-01/UIU-02) are the exception: they must stub `global.fetch` directly,
because the module under test *is* the mock boundary everything else replaces.

**Selector policy (settled — `MEMORY.md`):** component tests use **role/label** selectors; they assert
accessible semantics that `data-testid` cannot. `data-testid` is for the future Playwright tier only.
**Do not migrate passing component tests to testids** — churn with no coverage gain.

**Frontend money is IEEE-754, backend money is scale-8 `BigDecimal`** (settled — `MEMORY.md`). Any FE
scenario summing or displaying amounts must treat drift as behaviour to **characterize**, not as a
backend bug.

### 2.10 Commands

```
backend:   cd backend  && mvn test                       # full suite (starts embedded mongod)
           mvn test -Dtest=OrderServiceTest               # single class
frontend:  cd frontend && npm test                        # vitest run
           npx tsc -b                                     # type gate
```

---

## 3. Iteration 1 — backend + integration (`@backend-tester`, `@integration-tester`)

> Read **only** this section for iteration 1. Iterations 2 and 3 are queued and must not be started.
> Every scenario below is **pending review** until `decisions.json` exists.

### 3.1 `@integration-tester` — Integration tier (rules §2.6), real embedded MongoDB

**INT-01 — Per-test collection isolation in the shared harness** · *Enabler · blocks INT-07*

Add an `@AfterEach` to `IntegrationTestSupport` that injects `MongoTemplate` and calls
`mongoTemplate.getCollection("orders").drop()`. Test-directory change only — permitted under rules §7.
Re-run all 19 existing integration tests; if any starts failing it was silently depending on another
class's leftovers, which is exactly the latent flakiness this removes. Report any such test.

**INT-02 — Cumulative partial fills reaching exactly zero mark the order FILLED** · *CRITICAL · C1+C3 · AC-03/AC-08 · Monetary BVA + State Transition*

- Seed a `PENDING` order with `amount = remainingAmount = 1000.00000000`.
- Fill `333.33333333`, then `333.33333333`, then `333.33333334` through `OrderService.fillOrder`.
- After each of the first two: `status` is still `PENDING`.
- After the third: `remainingAmount.compareTo(BigDecimal.ZERO) == 0` **and** `status == FILLED` **and**
  `fillEvents` has exactly 3 entries, oldest-first, with those amounts.

Rationale: the only existing FILLED test fills the whole remaining amount in one shot, so repeated
scale-8 subtraction — what `data-model.md` decision 3 claims is safe, and what spec §8 raises as the
open *"phantom pending"* question — is completely unexercised.

**INT-03 — Fill boundary at remaining ± one smallest unit** · *CRITICAL · C3 · AC-03/AC-04 · BVA + Monetary BVA*

Parametrize into `OrderMongoOperationsIntegrationTest` against `remainingAmount = 300.00000000`:

| Input | Partition | Expected |
|---|---|---|
| `299.99999999` | max − 1 unit | accepted; `remainingAmount == 0.00000001`; `status` still `PENDING` |
| `300.00000000` | max | **already covered — do not duplicate** |
| `300.00000001` | max + 1 unit | rejected (`Optional.empty()`); re-read document unchanged, `fillEvents` still empty |

**INT-04 — A rejected amend must not partially apply the new trigger price** · *CRITICAL · C2+C3 · AC-07/AC-12 · State Transition (atomicity)*

Seed `amount = 1000`, `remainingAmount = 600`, one `FillEvent` of `400` (ceiling = 600), stored
`triggerPrice = 1.08500000`. Call `tryAmend(id, newPrice = 1.20000000, newRemaining = 700.00000000)`.

Assert: result is `Optional.empty()` **and** the re-read document still has `triggerPrice == 1.08500000`
**and** `remainingAmount == 600`.

Rationale: `tryAmendRejectsRemainingAboveAvailable` passes `null` for the price and asserts only
`isEmpty()`, so a partial `$set` could never be detected. This is the atomicity half of ADR-0001.

**INT-05 — Complete the concurrency pairwise matrix** · *CRITICAL · C2 · AC-13 · Pairwise + State Transition*

Covered today: fill×fill, fill×cancel (partial), fill×cancel (full). **Amend appears in no race.**
Add to `OrderConcurrencyIT`, reusing the existing `ExecutorService` + `CompletableFuture` shape, as a
**parametrized pair — not a copy-paste of the three existing race tests**:

- **amend × fill** — seed `amount = remainingAmount = 100`, no fills. Race `amendOrder(id, null, 40)`
  against `fillOrder(id, 60)`. Whichever order they land, assert the final document satisfies
  `remainingAmount >= 0` **and** `remainingAmount <= amount − Σ fills`, and that a losing fill threw
  `InvalidFillAmountException` with `Reason.EXCEEDS_REMAINING` rather than being silently dropped.
- **amend × cancel** — same seed. Race `amendOrder(id, 1.20, 50)` against `cancelOrder(id)`. Assert
  the final `status` is `CANCELLED`; if the cancel won, the stored `triggerPrice` is still the
  original (an amend must never mutate an order after a cancel takes effect); the losing action threw
  `OrderNotOpenException`.

**INT-06 — Full-stack HTTP contract walk** · *CRITICAL · rules §3.8 · Contract Testing + EP*

New class: `@SpringBootTest(webEnvironment = RANDOM_PORT)` + `TestRestTemplate` + real embedded Mongo,
**no mocked beans at all**. Every controller test mocks `OrderService`; every repository test bypasses
HTTP — nothing today exercises the real wire contract.

| Step | Request | Expected |
|---|---|---|
| 1 | `POST /api/orders` (valid) | `201`; `remainingAmount == amount`; `status: PENDING`; `fillEvents: []` |
| 2 | `GET /api/orders` | `200`; the created order present |
| 3 | `POST /api/orders/{id}/fills` `{amount: 400}` | `201`; `remainingAmount` reduced; one fill event |
| 4 | `POST /api/orders/{id}/fills` `{amount: 9999}` | `409`; `code == "order.fill_exceeds_remaining"` |
| 5 | `PATCH /api/orders/{id}` `{remainingAmount: 9999}` | `409`; `code == "order.amend_out_of_range"` |
| 6 | `DELETE /api/orders/{id}` | `200`; `status: CANCELLED` |
| 7 | `POST /api/orders/{id}/fills` `{amount: 1}` | `409`; `code == "order.not_pending"` |
| 8 | `DELETE /api/orders/{unknown valid ObjectId}` | `404` |

Assert HTTP status **and** `ApiError.code` against `docs/features/manage-orders/contracts/openapi.yaml`.
Re-verify the **seam**, not the logic behind it (rules §2.6) — do not re-test boundary values here;
INT-02/INT-03 own those.

**INT-07 — Mixed-status listing including a raw legacy document** · *Standard · AC-14 + AC-11 · EP · **depends on INT-01***

Seed four real documents: `PENDING`, `CANCELLED`, `FILLED`, and one **raw legacy** `Document` with
neither `remainingAmount` nor `fillEvents` — copy the `insertLegacyOrder()` pattern from
`OrderServiceLegacyDocumentIT`; a saved `Order` instance always carries a default empty list, so only a
hand-built document reproduces the field being absent. Assert `listOrders()` returns all four in
`createdAt`-descending order and that the legacy row's `remainingAmount` equals its own `amount`.

**INT-08 — Legacy-document EP completion** · *CRITICAL · C4 · AC-11 · EP (legacy × action)*

`OrderServiceLegacyDocumentIT` covers only `getOrder` and a price-only amend. Add the three untested
partitions against a raw legacy document:

- `cancelOrder` → succeeds; `status == CANCELLED`; returned `remainingAmount` falls back to `amount`.
- `fillOrder` → succeeds **through the service path** (the repository-level fallback is covered, the
  service path is not); reduces from the fallback base; appends one fill event.
- `amendOrder` **with** a `newRemaining` → the only case that exercises the
  `$ifNull("$fillEvents", [])` branch of the amend-ceiling `$reduce` when the field is absent from the
  document entirely. An amend up to `amount` is accepted; one above it is rejected.

**INT-09 — Retarget (or drop) the repository round-trip test** · *Cleanup*

`OrderRepositoryIntegrationTest`'s single test saves an `Order` and reads it back — it proves Spring
Data works, which rules §2.1 explicitly excludes. Retarget it onto the load-bearing storage fact:
amounts persist as **BSON strings** (§2.5), which is exactly why every operand in
`OrderMongoOperations` is wrapped in `$toDecimal`. Read the raw `Document` and assert `amount` is a
`String` at scale 8. If that cannot be asserted cleanly, **delete the test** and say so in the report.

### 3.2 `@backend-tester` — BE unit (rules §2.1)

Both collaborators mocked (`OrderRepository`, `OrderMongoOperations`). **Never touch a real database
at this tier** — that is `@integration-tester` territory.

**BEU-01 — `createOrder` with a sub-scale amount yields an unfillable PENDING order** · *CRITICAL · C3 · Monetary BVA + regression pin*

`createOrder(amount = 0.000000001)` with the repository mocked to echo its argument. Assert the
**current** outcome: saved order with `amount` and `remainingAmount` both comparing equal to zero and
`status == PENDING`. Comment the test as a pinned defect cross-referencing **E-01**.
**Pin current behaviour only** — asserting the desired behaviour would be red against an unapproved
production change (rules §7).

**BEU-02 — `amendOrder` positivity runs pre-normalization: pin the mechanics** · *CRITICAL · C3 · AC-12 · Monetary BVA + ordering regression*

`amendOrder(id, null, 0.000000001)` with `tryAmend` mocked empty and `findById` returning a `PENDING`
order. The raw check at `OrderService:81` passes (the value *is* > 0), `normalize()` yields
`0.00000000`, `tryAmend` refuses at its own `<= 0` guard, and `orElseGet` re-reads, finds `PENDING`,
and throws `InvalidAmendException` → **409 `order.amend_out_of_range`** quoting a ceiling the value
never approached. The identically shaped *fill* returns **400 `order.invalid_fill_amount`**.
Assert exception type and message shape as they are today. Cross-reference **E-02**. **Pin, do not fix.**

**BEU-03 — Assert `InvalidFillAmountException.Reason` and the no-DB-call claim** · *CRITICAL · C1+C3 · AC-04 · Decision Table + mutation hardening*

Strengthen **in place**; do **not** add new test methods. Affected:
`fillOrderRejectsZeroOrNegativeAmountBeforeAnyDbCall`,
`fillOrderRejectsSubScaleAmountThatNormalizesToZeroBeforeAnyDbCall`,
`fillOrderThrowsInvalidFillAmountWhenExceedsRemaining`.

| Input | `Reason` | HTTP |
|---|---|---|
| `0` | `NOT_POSITIVE` | 400 `order.invalid_fill_amount` |
| `-5` | `NOT_POSITIVE` | 400 `order.invalid_fill_amount` |
| `0.000000001` (normalizes to 0) | `NOT_POSITIVE` | 400 `order.invalid_fill_amount` |
| exceeds remaining | `EXCEEDS_REMAINING` | 409 `order.fill_exceeds_remaining` |

`Reason` is what `GlobalExceptionHandler` branches on to pick the status **and** the code the frontend
keys on; today every one of those three tests asserts only `isInstanceOf(...)`, so a mutant swapping
the two enum constants survives the entire suite while flipping the HTTP status.
Additionally: the two tests named `...BeforeAnyDbCall` never verify that claim — add
`verifyNoInteractions(orderMongoOperations)`.

**BEU-04 — `amendOrder` throws `OrderNotFoundException` for an unknown id** · *Standard · AC-10 · EP completeness*

`cancelOrder` and `fillOrder` each have a missing-id test; `amendOrder` does not, though its rejection
path routes through `getOrder(id)` and raises the same exception. Mock `tryAmend` → empty,
`findById` → empty; assert `OrderNotFoundException` (404), not `InvalidAmendException` (409).

**BEU-05 — Delete `filledStatusExistsOnEnum`** · *Cleanup*

It asserts `OrderStatus.valueOf("FILLED")` equals `OrderStatus.FILLED` — a property of the Java
language, not of this codebase. No mutant can kill it; no regression can break it without the module
failing to compile. Coverage padding under rules §1. Real FILLED coverage lives at INT-02.

**BEU-06 — Merge the two overlapping `createOrder` tests** · *Cleanup*

`createOrderSavesPendingOrder` (status, pair, type) is a strict subset of
`createOrderSetsRemainingAmountToNormalizedScaleEightAndNoFillEvents` (same, plus scale 8, remaining
amount, empty fill events). Keep the second, fold the pair/type assertions into it, delete the first.

### 3.3 `@backend-tester` — BE component (rules §2.4)

`@WebMvcTest(OrderController.class)` with `@MockBean OrderService` — the controller subsystem with its
dependency mocked. **No real database at this tier.**

**BEC-01 — `FillRequest` bean-validation vs service-validation decision table** · *Standard · AC-04 · Decision Table + Payload Boundary Analysis*

See §2.8 — the split is **settled**, not drift. Nothing tests the boundary it creates:

| Body | Validating layer | Expected |
|---|---|---|
| `{}` | bean validation | `400`, `code` **absent** — `jsonPath("$.code").doesNotExist()` |
| `{"amount": null}` | bean validation | `400`, `code` **absent** |
| `{"amount": 0}` | `OrderService` | `400`, `code == "order.invalid_fill_amount"` |

The presence-or-absence of `code` **is** the contract difference — assert it explicitly.

**BEC-02 — Malformed and unparseable request bodies** · *Standard · Error Guessing + Negative Testing (rules §3.6)*

`GlobalExceptionHandler` declares no `@ExceptionHandler` for `HttpMessageNotReadableException`, so
`{"amount": "abc"}` or truncated JSON falls through to Spring's default error response instead of the
uniform `ApiError` shape `openapi.yaml` promises for every 400 — and `orderApi.handleResponse` reads
`body?.messages`, so the frontend silently degrades to its generic fallback message.
**Characterize what actually comes back** on both `POST /{id}/fills` and `PATCH /{id}`. If it breaches
the documented contract, record it as a §8 finding — do **not** add the missing handler.

**BEC-03 — `AmendRequest` legal-partition completeness** · *Standard · AC-06 · Decision Table + EP*

| `triggerPrice` | `remainingAmount` | Expected | Covered today |
|---|---|---|---|
| present | present | `200` | **no** |
| absent | present | `200` | yes |
| present | absent | `200` | **no** |
| absent | absent | `400` (`@AssertTrue`) | yes |

Verify the captured `OrderService.amendOrder` arguments, **including the null**. The price-only row
matters twice: it is a documented `200` path in `openapi.yaml`, and it is exactly the partition
`AmendDialog` can never produce (UIC-03), so no other test at any tier will ever reach it.

### 3.4 `@frontend-tester` — iteration 1 scope: **none**

Do not start frontend work in iteration 1. Rationale: iteration 1 concentrates on the CRITICAL money
and concurrency paths, and two frontend scenarios (UIC-03, UIC-09) hang on §8 escalation outcomes that
iteration 1 will surface.

---

## 4. Iteration 2 — frontend (`@frontend-tester`) — QUEUED, do not start

Start only after iteration 1 has been reviewed by `@test-reviewer`. Tiers per rules §2.2 (UI unit) and
§2.3 (UI component). Harness, boundary mock and selector policy: see §2.9.

### 4.1 UI Unit

**UIU-01 — `orderApi.handleResponse` error-branch decision table** · *Standard · Decision Table + EP*

Stub `global.fetch`. `orderApi.ts` has never executed under test, yet `handleResponse` is the single
place the backend's `ApiError` shape becomes something the UI can show.

| Response | Expected |
|---|---|
| `ok`, JSON body | resolves to the parsed body |
| `!ok`, full `ApiError` body | throws `ApiRequestError`; `message === messages.join(", ")`; `status` and `code` carried through |
| `!ok`, non-JSON body (`.json()` rejects) | throws with the `"Request failed with status N"` fallback; `code` undefined |
| `!ok`, JSON with no `messages` | same fallback message |

**UIU-02 — Request-shape contract for all five exported functions** · *Standard · EP + Contract Testing*

`types/order.ts` is hand-synced to the Java DTOs with no codegen, so drift is invisible until runtime.
Assert method, path and body for `POST /api/orders`, `GET /api/orders`, `DELETE /api/orders/{id}`,
`POST /api/orders/{id}/fills` `{amount}`, `PATCH /api/orders/{id}` — against
`contracts/openapi.yaml` — plus the `Content-Type` header on the three writing calls.

**UIU-03 — `OrderEntryForm` client-side validation partitions and post-submit reset** · *Standard · EP + BVA*

Render in isolation with a stub `onSubmit`. `OrderEntryPage.test.tsx` walks only the happy path, so no
rejection branch has ever rendered. Partitions: malformed pair (`EURUSD`, `eur/usd`, `EUR/USDX`) vs
valid; trigger price empty / `0` / negative / positive; amount empty / `0` / negative / positive. Each
invalid partition blocks submission (`onSubmit` never called) and renders its specific message; the
valid combination calls `onSubmit` once with numeric values; after a resolved submit, price and amount
clear while pair, side and type are retained.

### 4.2 UI Component

**UIC-01 — `FillDialog` sends a request for empty and negative input** · *Standard · AC-04 · EP + Error Guessing*

Unlike `OrderEntryForm`, `FillDialog` has no client-side validation, and `Number("")` is `0`.
Characterize: `fillOrder` **is** called (with `0`, and with the negative value), and the server's
message is what the trader ends up seeing. Pin this; do not assert a guard that does not exist.

**UIC-02 — `CancelForfeitureDialog` two-step confirmation, in isolation** · *CRITICAL · C1 · AC-02 · State Transition*

AC-02 is the guard that stops a trader forfeiting money on one click, and it is verified exactly once
today, inside a page-level happy path. Test the machine directly: first **Confirm** → `cancelOrder`
**not** called, the irreversibility warning naming the forfeited remainder becomes visible, the button
relabels; second **Confirm** → `cancelOrder` called exactly once; **re-arm** — dismiss a half-armed
dialog, reopen it from the row, and assert the first click of the new dialog still does not cancel
(verify that `ManageOrdersPage` unmounts the dialog on dismiss; do not assume it).

**UIC-03 — `AmendDialog` always sends both fields** · *Standard · AC-06 · Decision Table + EP*

The dialog posts `{triggerPrice, remainingAmount}` unconditionally as `Number(...)`. Pin both
consequences: the API's legal price-only `PATCH` is unreachable from the UI, and clearing the price
sends `Number("") === 0`, which `@DecimalMin` rejects with a `400` the trader did not intend.
Characterize only; cross-reference **E-03**.

**UIC-04 — IEEE-754 drift in the already-filled totals** · *Standard · Monetary BVA (rules §3.2)*

`sumFilled` reduces with JavaScript `+` over doubles while the backend keeps scale-8 `BigDecimal`.
Fills of `0.1` and `0.2` render as `0.30000000000000004` — in `AmendDialog`'s "filled so far" line
and, more consequentially, in `CancelForfeitureDialog`'s "Already filled" line, the number naming what
is about to be permanently forfeited. **Characterize as expected frontend behaviour, not a backend
bug** (settled — `MEMORY.md`).

**UIC-05 — `ManageOrdersPage` loading and load-failure states** · *Standard · State Transition*

Every current test resolves `listOrders` immediately, so two of the page's three top-level states
never render. Leave `listOrders` pending → loading text, no list. Reject it → error banner, **no list
at all**, no stale confirmation banner.

**UIC-06 — `ManageOrdersList` empty state** · *Standard · EP (empty collection, rules §2.1)*

Render with `orders = []`: the empty-state message renders and no table, row or action button exists.

**UIC-07 — Fill-trail expand/collapse transitions** · *Standard · AC-08 · State Transition + Props Variation*

AC-08 is covered one direction only. `expandedId` holds a single id, so expansion is mutually
exclusive across rows. Assert: collapsing the same row hides the trail; the expander control is absent
entirely for a fill-less order; **expanding a second row collapses the first**; events still render
oldest-first with amount and timestamp.

**UIC-08 — Dismiss and rejection branches across all four dialogs** · *Standard · EP (parametrized)*

Each of `CancelDialog`, `CancelForfeitureDialog`, `FillDialog`, `AmendDialog` has an `onDismiss` path
and an `onRejected`-plus-inline-error path; only the fill dialog's rejection is exercised, once.
**One parametrized test** across all four: dismiss closes and calls no api function; a rejection
renders that dialog's own error element with the server message, leaves the dialog open, and triggers
the page's list re-fetch. **Do not write four near-identical tests.**

**UIC-09 — Dialog accessibility audit** · *Standard · rules §2.3*

Assert what exists: `role="dialog"` with a distinct accessible name per dialog, every input reachable
through its own label text, both buttons disabled while submitting. What is **missing** — no
`aria-modal`, no focus trap, no Escape-to-dismiss — requires production changes and is escalated as
**E-04**. Do not add attributes or markup to work around it (rules §7). Keep role/label selectors.

---

## 5. Iteration 3 — tooling (QUEUED, not in `review.html`)

> These two items have **no home among the template's five tiers** (BE Unit / BE Component / UI Unit /
> UI Component / Integration). They are deliberately **excluded from `review.html`** rather than forced
> into a tier — the template must not be altered. They are tracked here only.

**TL-01 — Stand up the Playwright E2E tier** · *`@frontend-tester`*

`tasks/tracker.md` marks T15 "e2e-through-UI tests" done; the Vitest runner shipped, an E2E tier did
not. Scope strictly to whole journeys (create → manage → fill → cancel) against a running backend.
**Do not** re-test validation branches, boundary values or error codes already covered at the
component and integration tiers. This is the tier where `data-testid` selectors are correct — the
attributes are already present on all seven components.

**TL-02 — Mutation testing** · *CRITICAL enabler · rules §6 · `@test-reviewer` + owning testers*

Rules §6 makes mutation score the actual merge gate — code coverage explicitly is not — and nothing
measures it today. Stryker over `orderApi.ts` and the dialog logic; PIT over `OrderService` and
`GlobalExceptionHandler`. Enforce the §6 threshold of 80% on those modules. **BEU-03 exists precisely
because a surviving mutant was found there by hand; TL-02 is what stops that being luck.**

---

## 6. Declined scenarios

**Downstream agents: this section is a hard prohibition. Never implement anything listed here.**

*(Empty — the review has not been completed. `.claude/test-plans/decisions.json` does not exist yet.
Once it does, every `state: "declined"` entry is recorded here with its `decline_reason` **verbatim**
as written by the developer — never inferred, never rewritten — and any `"manual": true` additions are
folded into the appropriate iteration above.)*

---

## 7. Execution mapping

| ID | Tier | Owner | Iteration | Risk |
|---|---|---|---|---|
| INT-01 | Integration (harness) | `@integration-tester` | 1 | Enabler — blocks INT-07 |
| INT-02 | Integration | `@integration-tester` | 1 | CRITICAL (C1+C3) |
| INT-03 | Integration | `@integration-tester` | 1 | CRITICAL (C3) |
| INT-04 | Integration | `@integration-tester` | 1 | CRITICAL (C2+C3) |
| INT-05 | Integration | `@integration-tester` | 1 | CRITICAL (C2) |
| INT-06 | Integration (HTTP contract) | `@integration-tester` | 1 | CRITICAL |
| INT-07 | Integration | `@integration-tester` | 1 | Standard |
| INT-08 | Integration | `@integration-tester` | 1 | CRITICAL (C4) |
| INT-09 | Integration | `@integration-tester` | 1 | Cleanup |
| BEU-01 | BE unit | `@backend-tester` | 1 | CRITICAL (C3) |
| BEU-02 | BE unit | `@backend-tester` | 1 | CRITICAL (C3) |
| BEU-03 | BE unit | `@backend-tester` | 1 | CRITICAL (C1+C3) |
| BEU-04 | BE unit | `@backend-tester` | 1 | Standard |
| BEU-05 | BE unit | `@backend-tester` | 1 | Cleanup |
| BEU-06 | BE unit | `@backend-tester` | 1 | Cleanup |
| BEC-01 | BE component (`@WebMvcTest`) | `@backend-tester` | 1 | Standard |
| BEC-02 | BE component (`@WebMvcTest`) | `@backend-tester` | 1 | Standard |
| BEC-03 | BE component (`@WebMvcTest`) | `@backend-tester` | 1 | Standard |
| UIU-01 | UI unit | `@frontend-tester` | 2 | Standard |
| UIU-02 | UI unit | `@frontend-tester` | 2 | Standard |
| UIU-03 | UI unit | `@frontend-tester` | 2 | Standard |
| UIC-01 | UI component | `@frontend-tester` | 2 | Standard |
| UIC-02 | UI component | `@frontend-tester` | 2 | CRITICAL (C1) |
| UIC-03 | UI component | `@frontend-tester` | 2 | Standard |
| UIC-04 | UI component | `@frontend-tester` | 2 | Standard |
| UIC-05 | UI component | `@frontend-tester` | 2 | Standard |
| UIC-06 | UI component | `@frontend-tester` | 2 | Standard |
| UIC-07 | UI component | `@frontend-tester` | 2 | Standard |
| UIC-08 | UI component | `@frontend-tester` | 2 | Standard |
| UIC-09 | UI component | `@frontend-tester` | 2 | Standard |
| TL-01 | E2E (no template tier) | `@frontend-tester` | 3 | Standard |
| TL-02 | Tooling (no template tier) | `@test-reviewer` | 3 | CRITICAL |

**Definition of done, iteration 1:** `mvn test` green, no production file modified, every pinned-defect
test carrying a comment naming its E-item, and every INT scenario re-run after INT-01 lands.

**Definition of done, iteration 2:** `npm test` green, `npx tsc -b` clean, no production file modified,
role/label selectors throughout, no MSW introduced.

---

## 8. Blocked / escalated — user decision required (rules §7)

No test agent may make any of these changes. They are behaviour or markup changes to **production**
code and need **explicit user approval** before anyone implements them (rules §7, "Explicit exception
process only"). Until then the corresponding scenarios **pin current behaviour**.

**E-01 — `OrderService.createOrder` never re-checks positivity after `normalize()`.**
A sub-scale positive amount (e.g. `0.000000001`) passes `@DecimalMin("0.0", exclusive)`, normalizes to
`0.00000000`, and is persisted as a `PENDING` order with `amount = remainingAmount = 0` — unfillable,
and unable to ever reach `FILLED`. `backend/.../service/OrderService.java:34-44`.
*Pinned by BEU-01.* Fix would be a positivity check on the normalized value, mirroring `fillOrder`.

**E-02 — `OrderService.amendOrder` checks positivity before normalizing** (the reverse of `fillOrder`),
so a sub-scale positive remaining amount surfaces as **409 `order.amend_out_of_range`** with a
misleading ceiling message instead of **400 `order.invalid_fill_amount`**-equivalent.
`backend/.../service/OrderService.java:80-86`. *Pinned by BEU-02.*

**E-03 — `AmendDialog` sends both fields unconditionally.**
`frontend/src/components/AmendDialog.tsx:28-31`. Two consequences: the documented price-only `PATCH`
is unreachable from the UI, and a cleared price field sends `Number("") === 0`, producing a `400` the
trader did not cause. *Pinned by UIC-03; the orphaned API partition is covered at BEC-03.*

**E-04 — Dialogs lack `aria-modal`, a focus trap and Escape-to-dismiss.**
All four dialog components. Rules §2.3 expects keyboard navigation and accessibility roles within the
component boundary; the roles and labels exist, the modal semantics do not. *Partially asserted by
UIC-09; the gap itself needs a production change.*

**Non-blocking notes for `@test-reviewer`:**

- The integration substrate is embedded Flapdoodle `mongod`, not a Testcontainers container (§2.3). A
  real database, so the intent of rules §2.6 is met — flagged for awareness, not to be swapped without
  a decision.
- Spec §8 leaves the *"phantom pending"* rounding question open (a near-zero-but-not-zero remaining
  amount blocking the `PENDING → FILLED` transition). INT-02 and INT-03 characterize the current
  behaviour at scale 8; they do not close the question.

---

## 9. Delta versus the superseded pass-3 plan

Recorded so `@test-reviewer` can see what moved and why. Pass 3: 30 scenarios, 28 rendered. Pass 4:
30 scenarios, **all 30 rendered**.

| Change | Detail |
|---|---|
| **ID scheme** | `BE-*` / `FE-*` / `IT-*` → tier-prefixed `BEU-* / BEC-* / UIU-* / UIC-* / INT-*`, so `decisions.json` entries map unambiguously onto the template's five tiers. |
| **Tier split made explicit** | Pass 3 filed `BE-05/06/07` under a `BE-*` prefix while describing them as `@WebMvcTest` work. They are now explicitly **BE Component** (`BEC-01..03`), matching rules §2.4 and the template slot. |
| **Added** | `UIU-03` — `OrderEntryForm` client-side validation partitions in isolation. Pass 3 had no UI-unit coverage of the one component whose rejection branches have literally never rendered. |
| **Merged** | The pass-3 "verify no DB call" weakness is folded into `BEU-03` rather than left implicit — the two tests named `…BeforeAnyDbCall` never verified that claim. |
| **Dropped** | A standalone `FillTrail`-in-isolation scenario was considered and **rejected as overtesting** (rules §1): oldest-first ordering is already asserted at page level, and the remaining surface is `key={index}` plus `toLocaleString()`. |
| **Unchanged and re-verified first-hand** | The harness-isolation defect (§2.4 — confirmed: zero cleanup hooks in any of the six integration classes); the missing `Reason` assertions (confirmed: all three tests assert only `isInstanceOf`); amend absent from every race test (confirmed: `OrderConcurrencyIT` has exactly three tests, all fill-versus-X); `orderApi.ts` at zero coverage (confirmed); the three-way positivity/normalization ordering (confirmed line by line). |
| **Code drift since pass 3** | **None.** No file under `backend/src`, `frontend/src` or `docs/features/manage-orders/` has changed since the pass-3 plan was written. What changed is the review tooling and this agent's own protocol (§1.1). |

---

## 10. Next step

1. Open `.claude/test-plans/review.html`, set every scenario to **Accept** or **Decline** (a decline
   requires a reason from the dropdown), optionally add scenarios of your own, then click
   **Review Completed** — which writes `.claude/test-plans/decisions.json`.
2. `@test-strategist` re-reads `decisions.json`, rewrites §3 / §4 / §6 / §7 of this file to the final
   accepted set, and consolidates each decline into a generalized pattern in
   `.claude/agent-memory/test-strategist/MEMORY.md`.
3. Only then may `@backend-tester` and `@integration-tester` start **iteration 1**.
