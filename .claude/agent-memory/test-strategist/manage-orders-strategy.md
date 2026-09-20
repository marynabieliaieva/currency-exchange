# Test Strategy — manage-orders (branch `feature/manage-orders`)

Author: test-strategist · Date: 2026-09-13 · Rules source: `.claude/rules/test-strategy.md` §1–§3
Status: Iteration 1 proposed. Execution payload: `.claude/test-plans/active-plan.md`

---

## 0. Scope discrepancy that must be reconciled before anything else

`CLAUDE.md` (repo root, "What this is") states:

> "Orders only ever move `PENDING` → `CANCELLED`; there is no 'filled' state."

This branch contradicts that directly. It adds `OrderStatus.FILLED`, `POST /api/orders/{id}/fills`,
`PATCH /api/orders/{id}` (amend), an embedded `FillEvent` list, and a `PENDING → FILLED`
auto-transition. `CLAUDE.md` is the document every agent reads first, so leaving it stale means every
future strategist/tester run starts from a false model of the domain — including a false belief that
the state machine has only two states, which is precisely the critical path this strategy targets.

**Decision required (not mine to make):** either update `CLAUDE.md` to describe the three-state
machine and the fill/amend endpoints, or confirm that fill/amend are out of the module's intended
scope. Nothing below assumes which way it goes; the strategy is written against the code and
`docs/features/manage-orders/spec.md` as they actually are.

Related, smaller: `docs/features/manage-orders/tasks/tracker.md` marks T15 "Add a frontend test
runner and **e2e-through-UI tests**" as `done`. There are no e2e tests. The frontend suite is Vitest +
Testing Library with `vi.mock("../api/orderApi")` — no browser, no real network, no Playwright. The
tracker row overstates what shipped.

---

## 1. Risk classification (rules §1, risk-based coverage thresholds)

**CRITICAL — target: 100% of defined state transitions and boundary classes.**

| # | Path | Why critical | ACs |
|---|---|---|---|
| C1 | Order state machine: `PENDING→CANCELLED`, `PENDING→FILLED`, and every illegal action from `CANCELLED`/`FILLED` | A wrong transition permanently mis-states money owed; no correction/reversal path exists (spec §3) | AC-01, AC-02, AC-03, AC-10 |
| C2 | Concurrency serialization of cancel/fill/amend via the ADR-0001 atomic conditional update | The rules name "delivery guarantees" as critical; this is the same class — the guard IS the correctness proof | AC-05, AC-13, §6 NFR |
| C3 | Monetary arithmetic: scale-8 `HALF_UP` normalization, remaining-amount decrement, exact-zero `FILLED` trigger, amend ceiling `= amount − Σfills` | Currency logic, explicitly critical per §1; §3.2 monetary BVA applies in full | AC-03, AC-04, AC-07, AC-12 |
| C4 | AC-11 legacy-document read/write fallback (`remainingAmount`/`fillEvents` absent) | A wrong fallback silently corrupts a real order's remaining amount with no audit trail | AC-11 |

**STANDARD — EP/BVA coverage, no fixed percentage.**

| # | Path | ACs |
|---|---|---|
| S1 | Mixed-status listing + per-row action gating | AC-14 |
| S2 | Fill-trail rendering, oldest-first | AC-08 |
| S3 | Routing, entry-page creation-only | AC-09, AC-15 |
| S4 | Error surfacing in dialogs, in-flight disable, post-rejection row refresh | AC-04, AC-10, AC-12 |
| S5 | Dialog a11y and keyboard behaviour within the component boundary | (rules §2.3) |

---

## 2. Tier map, with one deliberate deviation

| Tier | What it holds for this feature | Files |
|---|---|---|
| BE unit | `OrderService` with `OrderRepository` + `OrderMongoOperations` mocked; normalization, rejection routing, AC-11 fallback | `OrderServiceTest` |
| BE component | `@WebMvcTest(OrderController)` with `OrderService` mocked; status codes, `ApiError` envelope, `code` field, bean validation | `OrderControllerTest` |
| FE unit | *(currently empty — see gap G10)* hooks/utils/API-client logic | `src/api/orderApi.ts` has **no test at all** |
| FE component | Page + dialogs mounted together, API module mocked | `ManageOrdersPage.test.tsx`, `OrderEntryPage.test.tsx`, `App.test.tsx` |
| Integration | Real (embedded Flapdoodle) MongoDB + Spring context | `OrderMongoOperationsIntegrationTest`, `OrderConcurrencyIT`, `OrderServiceLegacyDocumentIT`, `OrderRepositoryIntegrationTest` |

**Deviation (recorded deliberately).** Rules §2.4 says repository logic belongs at BE-component tier
against a *mocked* driver, never a real database. That is not achievable here and should not be
attempted: the entire logic under test in `OrderMongoOperations` **is** MongoDB query language —
`$expr`/`$toDecimal` guards, a `$reduce` over `fillEvents`, and an update-with-aggregation-pipeline.
A mocked driver would assert that we built the `Document` we built, i.e. a tautology with zero
mutation value, which §1 forbids as coverage padding. So this feature intentionally has **no BE
repository component tier**; that logic is covered at Integration tier only.

Consequence worth naming: `OrderMongoOperationsIntegrationTest` lives in `src/test/.../repository/`
and is named like a repository test, but by the rules' own taxonomy it is an Integration-tier suite.
It is owned by `@integration-tester`, not `@backend-tester`.

---

## 3. Requirement → tier → technique matrix

Legend — `U` BE unit · `Cbe` BE component · `Ufe` FE unit · `Cfe` FE component · `I` Integration.
Status: **covered** / **partial** / **GAP-n**.

| AC | Risk | U | Cbe | Ufe | Cfe | I | Technique | Status |
|---|---|---|---|---|---|---|---|---|
| AC-01 cancel, no fills | C1 | ✔ | ✔ | — | ✔ | ✔ | State Transition | covered |
| AC-02 cancel with forfeiture, remaining left unchanged | C1 | ✔ | — | — | ✔ | ✔ | State Transition, Decision Table (fills present?) | covered |
| AC-03 fill reduces remaining; zero ⇒ FILLED | C1+C3 | ✔ | ✔ | — | ✔ | partial | BVA (monetary), State Transition | **GAP-2, GAP-3** — only single full fills tested; no cumulative multi-fill to exact zero |
| AC-04 fill zero / negative / over-remaining | C3 | ✔ | ✔ | — | ✔ | partial | EP, BVA | **GAP-3, GAP-4** — boundary tested only coarsely (400 vs 300); sub-scale rounding tested on one side only |
| AC-05 two racing fills, never partial | C2 | — | — | — | ✔ (in-flight disable) | ✔ | Concurrency, State Transition | partial — **GAP-6** weak assertions |
| AC-06 amend price and/or remaining | C1 | ✔ | ✔ | — | ✔ | ✔ | EP | covered |
| AC-07 amend never touches filled portion | C3 | ✔ | — | — | ~ | ✔ | Decision Table (ceiling source) | covered at I; FE test is mis-scoped (**O6**) |
| AC-08 fill trail, oldest first | S2 | — | — | — | ✔ | — | State Transition | **GAP-2** — never proven against real Mongo append ordering with ≥2 fills |
| AC-09 entry page creation-only | S3 | — | — | — | ✔ | — | EP | covered |
| AC-10 act on closed order | C1 | ✔ | ✔ | — | ✔ | partial | **Decision Table** {cancel,fill,amend} × {CANCELLED,FILLED} | **GAP-1** — 1 of 6 cells covered deterministically at the data layer |
| AC-11 legacy document fallback | C4 | ✔ | — | — | — | partial | EP (legacy vs modern) × action | **GAP-7** — only `getOrder` + price-only amend |
| AC-12 amend out of range / exactly zero | C3 | ✔ | ✔ | — | ✔ | ✔ | BVA (ceiling−1, ceiling, ceiling+1, 0) | partial — ceiling±1 tested, 0 tested; ceiling-exactly untested at I |
| AC-12 amend, **sub-scale positive** remaining (normalization-ordering defect) | C3 | — | — | — | — | — | Monetary BVA + ordering regression | **GAP-16** — wholly uncovered at every tier |
| AC-13 any two concurrent actions | C2 | — | — | — | ✔ | partial | **Pairwise** over {cancel,fill,amend}² | **GAP-5** — 2 of 6 unordered pairs covered |
| AC-14 all statuses listed, actions gated | S1 | ✔ (mocked) | — | — | ✔ | — | EP | **GAP-9** — `findAllByOrderByCreatedAtDesc` never run against a real DB |
| AC-15 distinct addresses | S3 | — | — | — | ✔ | — | State Transition (nav) | covered |
| §6 NFR concurrency safety | C2 | — | — | — | — | ✔ | — | partial (see AC-05/AC-13) |
| §3.8 FE↔BE contract | C1–C3 | — | — | — | — | — | Contract Testing | **GAP-8** — no test exercises the real wire contract |

---

## 4. Gaps (full detail lives in `.claude/test-plans/active-plan.md`)

| ID | Tier | Risk | One-line |
|---|---|---|---|
| GAP-1 | I | Critical | Deterministic `PENDING`-guard tests for `tryFill`/`tryAmend` against `CANCELLED` and `FILLED` — 5 of 6 decision-table cells rely on timing or mocks |
| GAP-2 | I | Critical | Cumulative partial fills summing to exactly zero at scale 8 ⇒ `FILLED` — resolves the spec §8 "phantom pending" open question with evidence, and proves AC-08 append order |
| GAP-3 | I | Critical | Fill BVA at the remaining boundary: `R−0.00000001` / `R` / `R+0.00000001` |
| GAP-4 | U | Critical | Sub-scale rounding boundary — `0.000000005` rounds `HALF_UP` to a *valid* fill; only the round-to-zero side is tested today |
| GAP-5 | I | Critical | Pairwise concurrency: `amend‖fill`, `amend‖cancel`, `cancel‖cancel` |
| GAP-6 | I | Critical | Harden `exactlyOneOfTwoConcurrentOverfillingFillsSucceeds` — assert `fillEvents` size/amount, not just the remaining total |
| GAP-7 | I | Critical | AC-11 on a genuinely legacy raw document for `cancel`, `fill`, `amend(remainingAmount)`, `listOrders` — the `$ifNull` inside `filledAmount()`'s `$reduce` is completely unexercised |
| GAP-8 | I | Critical | Full-stack HTTP contract test against `contracts/openapi.yaml` (real service + real Mongo) |
| GAP-9 | I | Standard | `findAllByOrderByCreatedAtDesc` ordering + AC-14 against a real DB; needs collection cleanup first |
| GAP-10 | Ufe | Standard | `src/api/orderApi.ts` has zero coverage — the FE↔BE error-mapping contract is untested |
| GAP-11 | Cfe | Standard | `FillDialog` has no client-side validation: empty ⇒ `Number("") === 0`, text ⇒ `NaN` ⇒ `null` on the wire |
| GAP-12 | Cfe | Standard | FE monetary display uses JS `number` where the backend uses scale-8 `BigDecimal` — `sumFilled` drifts |
| GAP-13 | Cfe | Standard | Dialog a11y: Escape, focus trap, focus restore, `aria-modal` |
| GAP-14 | tooling | Critical enabler | No mutation testing configured (no PIT, no Stryker) — rules §6 is currently unenforceable |
| ~~GAP-15~~ | — | — | **RESOLVED 2026-09-13.** `data-testid` added to all 7 components by the coordinator with user approval. Unblocks the E2E tier → GAP-17 |
| **GAP-16** | U + I | **Critical** | `amendOrder` checks positivity **before** normalization, so a sub-scale positive value reaches `tryAmend` as zero — uncovered at every tier, and the guard that saves it was nearly deleted on my own bad advice |
| GAP-17 | E2E | Standard | Playwright/e2e tier now unblocked but does not exist; tracker T15 claims it shipped |

### Escalations under rules §7 — status as of 2026-09-13

1. ~~**`data-testid` attributes**~~ — **RESOLVED.** Added to all 7 components (`OrderEntryForm`,
   `ManageOrdersList`, `CancelDialog`, `CancelForfeitureDialog`, `FillDialog`, `AmendDialog`,
   `FillTrail`) with user approval; 19/19 Vitest and `tsc -b && vite build` still pass. Verified in
   the working tree: stable containers, fields, buttons, error/warning nodes, and per-entity ids
   (`order-row-${id}`, `order-cancel-${id}`, `fill-trail-item-${index}`).
   *Selector policy going forward:* component tests keep **role/label** selectors — they assert
   accessible semantics, which is coverage `data-testid` cannot give — and the new E2E tier uses
   `data-testid` for refactor stability. Do **not** churn the 19 passing tests over to testids;
   that is motion without coverage. Minor follow-up: `ManageOrdersPage.tsx` itself still has none,
   so the confirmation banner is text-selected; fine for now, worth one id if E2E needs it.
2. **`AmendDialog.sumFilled`** is module-private. Testing it directly at FE-unit tier needs an
   export. Not required — GAP-12 is written against the rendered component instead.
3. ~~**`tryAmend`'s `newRemaining <= 0` early return is dead code**~~ — **RETRACTED. I was wrong.**
   The branch is reachable and load-bearing. `AmendRequest.@DecimalMin(inclusive=false)` accepts
   `0.000000001`; `OrderService.amendOrder:81-83` then checks positivity on the **raw** value (passes);
   `normalize()` at :85 rounds it `HALF_UP` at scale 8 to exactly `0.00000000`, which is what reaches
   `tryAmend`. Delete the branch and the filter's `$expr: (amount − Σfills) >= 0` is trivially true,
   so Mongo would `$set remainingAmount = "0.00000000"` on a **PENDING** order with no `FILLED`
   transition — breaking the core state-machine invariant silently and permanently (no reversal path
   exists, spec §3). **Never delete it. It needs a pinning regression test, not removal — GAP-16.**
   *Root-cause lesson:* I judged reachability from the call graph alone and ignored that a
   normalization step sits between the guard and its consumer. Trace value transformations, not just
   control flow, before calling a defensive branch dead.
4. ~~**`FillRequest` drift**~~ — **SETTLED, and the original proposal was wrong.** `FillRequest`
   correctly has only `@NotNull`; adding `@DecimalMin` would intercept before `OrderService` runs, and
   since `GlobalExceptionHandler.handleValidation` never sets `ApiError.code`, it would silently drop
   the documented `code: "order.invalid_fill_amount"` and break
   `OrderControllerTest.recordFillReturns400WithCodeWhenAmountNotPositive`. More fundamentally, only a
   **post-normalization** check catches a sub-scale positive amount — the same defect class as GAP-16,
   which `fillOrder` gets right and `amendOrder` gets wrong. `contracts/openapi.yaml` was corrected to
   document the service-raised 400 instead. **Do not re-flag this as drift.**
5. **NEW — production-code fix recommendation (needs explicit user approval).** Reorder
   `OrderService.amendOrder` so the positivity check runs **after** `normalize()`, mirroring
   `fillOrder:64-67`. This is a behaviour fix, not test-only: today a sub-scale amend is rejected as
   **409 `order.amend_out_of_range`** with a misleading ceiling message (because `tryAmend` returns
   empty and the service re-reads, finds the order still `PENDING`, and falls to the ceiling branch),
   whereas the identical sub-scale *fill* is **400 `order.invalid_fill_amount`**. Same input class,
   two different status codes. Approving the fix changes an API response, so it also needs a
   `contracts/openapi.yaml` update. Until approved, tests pin current behaviour (see GAP-16 split).

---

## 5. Over-testing / coverage padding to remove (rules §1)

| ID | Where | Verdict |
|---|---|---|
| O1 | `OrderServiceTest.filledStatusExistsOnEnum` | Delete. `OrderStatus.valueOf("FILLED") == OrderStatus.FILLED` tests the Java language; no mutant can kill it |
| O2 | `OrderServiceTest.createOrderSavesPendingOrder` | Merge into `createOrderSetsRemainingAmountToNormalizedScaleEightAndNoFillEvents`, which strictly subsumes it |
| O3 | Three `...ReturnsEmptyForMalformedId` tests | Collapse to one `@ParameterizedTest`. They also boot the full Spring context for a pure `ObjectId.isValid` guard that touches no database |
| O4 | Amend-to-zero, asserted at four places | Keep the controller-tier one (the only HTTP-reachable path) and the service-tier one (defence in depth). Do not add a fifth at integration tier |
| O5 | `OrderRepositoryIntegrationTest` | Do **not** delete — *retarget*. As written it tests Spring Data mapping (§2.1 forbids). Rewritten to assert `BigDecimal` persists as a BSON **string**, it becomes the regression test that catches anyone registering `MongoCustomConversions` and silently breaking every `$toDecimal` guard |
| O6 | `ManageOrdersPage.test.tsx` AC-07 case | Mis-scoped: it asserts an invariant against a response the test itself mocks, so it can never fail. Keep as a "dialog shows filled-so-far and passes remainingAmount through" test and rename; the AC-07 invariant is owned by GAP-7 at integration tier |

---

## 6. Test-harness hygiene

- **No DB isolation.** `IntegrationTestSupport` never drops the `orders` collection. Four IT classes
  share one embedded Mongo and one Spring context. Nothing asserts on whole-collection state today,
  so it is green by luck; GAP-9 makes that luck run out. Add a `@BeforeEach` collection drop to
  `IntegrationTestSupport` — test-directory only, no §7 escalation.
- **Flaky-test policy (§3.7).** The concurrency suite is the only interleaving-dependent code here.
  It is written to be outcome-deterministic (the guard decides, not the scheduler), and GAP-5/GAP-6
  must preserve that: assert the *set of consistent final states*, never a specific winner.
- **Mutation testing (§6).** Add PIT (`pitest-maven`) scoped to `com.currencyexchange.orderentry.service`
  and `.repository`, and Stryker scoped to `src/api` + `src/components`; 80% threshold per §6. Until
  then, "these tests validate real business logic" is exactly the assumption §1 forbids.

---

## 7. Iteration plan

- **Iteration 1** — GAP-1..GAP-9 and **GAP-16** (all Critical-path + the harness hygiene that unblocks
  GAP-9), plus O1/O2/O3/O5/O6 cleanup. Owners: `@integration-tester` (1,2,3,5,6,7,8,9, 16b),
  `@backend-tester` (4, 16a, O1–O5).
- **Iteration 2** — GAP-10..GAP-13. Owner: `@frontend-tester`. GAP-13 likely surfaces a §7
  escalation on focus management.
- **Iteration 3** — GAP-17 (Playwright E2E, now unblocked) + GAP-14 tooling, then re-run every tier
  under mutation testing and treat the score as the real gate.

The `CLAUDE.md` reconciliation and the escalation-5 `amendOrder` reorder are user decisions, not
iteration items. GAP-15 (`data-testid`) is closed.
