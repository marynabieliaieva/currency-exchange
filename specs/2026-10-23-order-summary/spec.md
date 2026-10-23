# Spec: Order summary helper   |   Spec ID: SPEC-01   |   Status: implemented
Modules: frontend
Supersedes: —

## Problem and why

The frontend works with arrays of `Order` (`frontend/src/types/order.ts`) but has no single, tested way to aggregate them: how many orders exist, how they split across `OrderStatus` values (`PENDING`, `CANCELLED`, `FILLED`), and how much amount is still open per currency pair. A pure, side-effect-free helper `summarizeOrders(orders: Order[])` gives future screens one aggregation to reuse, and keeps that logic in a unit-testable function instead of inside a component.

This spec defines only the helper's observable behaviour (input → output). It does not wire the helper into any screen.

## Goals / Non-goals

**Goals**

- G-1: Provide a pure frontend function `summarizeOrders(orders: Order[])` that takes the existing `Order` type from `frontend/src/types/order.ts`.
- G-2: Return the total number of orders.
- G-3: Return a count for every `OrderStatus` value (`PENDING`, `CANCELLED`, `FILLED`); every status is always present, with `0` when no order has it.
- G-4: Return `openAmountByPair`: for `PENDING` orders only, the sum of `remainingAmount` per `currencyPair`, rounded to 8 decimal places; pairs with no `PENDING` orders are absent.
- G-5: For an empty input array, return total `0`, every status count `0`, and an empty `openAmountByPair`.
- G-6: Never mutate the input array or any `Order` / `FillEvent` object in it.
- G-7: The behaviour is covered by Vitest unit tests, and `npm test` (`vitest run`) in `frontend/` passes.

**Non-goals**

- NG-1: No UI changes — no new or changed component, page, route, `data-testid` or copy.
- NG-2: No backend changes (`backend/` is untouched).
- NG-3: No API changes — `frontend/src/api/orderApi.ts` and the REST contract (`docs/features/manage-orders/contracts/openapi.yaml`) are untouched.
- NG-4: No changes to the `Order`, `OrderStatus` or `FillEvent` types; the helper consumes them as they are.
- NG-5: No currency conversion across pairs — amounts are only ever summed within one `currencyPair`.
- NG-6: No validation or correction of input data that contradicts the backend invariants (e.g. a `PENDING` order with `remainingAmount` `0`, negative, `null` or `NaN`). Such values are summed as-is; the resulting output is unspecified and not tested. (Resolved CL-3.)
- NG-7: No aggregation of `CANCELLED` or `FILLED` amounts and no fill-history (`fillEvents`) statistics.
- NG-8: No handling of runtime `status` values outside `OrderStatus`. The TypeScript `Order` type is the input contract; behaviour for an unknown status string is unspecified and not tested, and AC-5 applies only to type-conforming input. (Resolved CL-4.)
- NG-9: No measurable time budget for the helper; NFR-1 only requires a single linear pass. (Resolved CL-5.)
- NG-10: No mutation-testing merge gate for this helper — it is classified as a *standard* risk path. (Resolved CL-6.)

## User stories

- US-1: As a frontend developer, I want one function that tells me how many orders I have in total and per status, so that any screen can show counts without re-implementing the aggregation.
- US-2: As a frontend developer, I want the still-open (`PENDING`) amount summed per currency pair, so that I can show the outstanding exposure per pair.
- US-3: As a frontend developer, I want the helper to be pure and deterministic, so that I can call it on React state without side effects or surprising re-render bugs.
- US-4: As a maintainer, I want the helper covered by Vitest unit tests in the existing `npm test` run, so that regressions are caught automatically.

## Contract

The helper is a pure function. The shape below defines its observable output; exact exported type names are left to the planner.

```ts
summarizeOrders(orders: Order[]): {
  total: number;                              // number of elements in `orders`
  byStatus: {                                 // always has all three keys
    PENDING: number;
    CANCELLED: number;
    FILLED: number;
  };
  openAmountByPair: Record<string, number>;   // key = Order.currencyPair, e.g. "EUR/USD"; value rounded to 8 decimals
}
```

- Field names are `total`, `byStatus` and `openAmountByPair`; `openAmountByPair` is a plain object (`Record<string, number>`), not a `Map`. (Resolved CL-1.)
- `byStatus` keys are exactly the members of `OrderStatus` in `frontend/src/types/order.ts`.

## Acceptance criteria (EARS)

- **AC-1** — The `summarizeOrders` helper shall accept an array of `Order` (type from `frontend/src/types/order.ts`) and return an object with `total`, `byStatus` and `openAmountByPair`, where `openAmountByPair` is a plain object (`Record<string, number>`), not a `Map`.
  Verify: unit — calling it with a typed `Order[]` compiles under `tsc -b`; the returned object has exactly these three properties and `result.openAmountByPair instanceof Map` is `false`.

- **AC-2** — WHEN `summarizeOrders` is called with an array of N orders, the helper shall return `total` equal to N.
  Verify: unit — arrays of 1 and 5 orders with mixed statuses return `total` 1 and 5.

- **AC-3** — WHEN `summarizeOrders` is called, the helper shall return in `byStatus` the number of input orders whose `status` is `PENDING`, `CANCELLED` and `FILLED` respectively.
  Verify: unit — input with 2 `PENDING`, 1 `CANCELLED`, 3 `FILLED` returns `{ PENDING: 2, CANCELLED: 1, FILLED: 3 }`.

- **AC-4** — The `summarizeOrders` helper shall always include all three keys `PENDING`, `CANCELLED` and `FILLED` in `byStatus`, with value `0` for any status that no input order has.
  Verify: unit — input containing only `FILLED` orders returns `PENDING: 0` and `CANCELLED: 0` (keys present, not `undefined`).

- **AC-5** — The `summarizeOrders` helper shall return `byStatus` counts whose sum equals `total` for any input whose every `status` is a member of `OrderStatus` (see NG-8).
  Verify: unit — for every type-conforming test input, `PENDING + CANCELLED + FILLED === total`.

- **AC-6** — WHEN `summarizeOrders` is called, the helper shall set `openAmountByPair[p]` to the sum of `remainingAmount` over all input orders with `status` `PENDING` and `currencyPair` equal to `p`, rounded as defined in AC-15.
  Verify: unit — two `PENDING` `EUR/USD` orders with `remainingAmount` 100 and 250 and one `PENDING` `GBP/USD` with 40 return `{ "EUR/USD": 350, "GBP/USD": 40 }`.

- **AC-7** — The `summarizeOrders` helper shall exclude orders with `status` `CANCELLED` or `FILLED` from `openAmountByPair`, regardless of their `remainingAmount`.
  Verify: unit — a `CANCELLED` `EUR/USD` order with `remainingAmount` 500 next to a `PENDING` `EUR/USD` order with 100 returns `"EUR/USD": 100`.

- **AC-8** — IF a `currencyPair` has no input order with `status` `PENDING`, THEN the `summarizeOrders` helper shall not include that pair as a key in `openAmountByPair`.
  Verify: unit — input with only `CANCELLED`/`FILLED` `USD/JPY` orders returns an `openAmountByPair` for which `"USD/JPY" in result` is `false` (key absent, not `0`).

- **AC-9** — WHEN `summarizeOrders` is called with an empty array, the helper shall return `total` `0`, `byStatus` `{ PENDING: 0, CANCELLED: 0, FILLED: 0 }` and `openAmountByPair` `{}` (no keys).
  Verify: unit — `summarizeOrders([])` deep-equals that object.

- **AC-10** — The `summarizeOrders` helper shall not mutate its input: after the call, the input array has the same length, element order and element identities, and every `Order` (including its `fillEvents` array and `FillEvent` objects) has the same property values as before.
  Verify: unit — call on a deep-frozen input (`Object.freeze` recursively) without throwing in strict mode, and assert a deep-equal against a structured clone taken before the call.

- **AC-11** — WHEN `summarizeOrders` is called twice with equal input, the helper shall return deep-equal results, and the returned object shall not share references with the input.
  Verify: unit — two calls on the same array deep-equal each other; mutating the first result does not change the second result or the input.

- **AC-12** — The `summarizeOrders` helper shall perform no I/O and no side effects (no network, storage, logging, timers, or global state access).
  Verify: unit — the helper module imports nothing but types; tests run with no `fetch` mock and pass. Code review confirms.

- **AC-13** — The frontend package shall contain Vitest unit tests covering AC-1 through AC-11, AC-15 and AC-16, and `npm test` in `frontend/` shall exit with code 0, with all pre-existing tests (`App.test.tsx`, `ManageOrdersPage.test.tsx`, `OrderEntryPage.test.tsx`) still passing.
  Verify: run `npm test` in `frontend/` — exit code 0, new test file listed in the Vitest report, no previously passing test failing.

- **AC-14** — The change shall modify no file outside `frontend/`, and no file under `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/api/` or `frontend/src/types/`.
  Verify: `git diff --name-only` against the base branch lists only the new helper module and its test file under `frontend/src/`.

- **AC-15** — WHEN `summarizeOrders` computes the sum for a `currencyPair`, the helper shall round that pair's total sum (not each addend) to 8 decimal places, rounding half-up on the 9th decimal place.
  Verify: unit — two `PENDING` `EUR/USD` orders with `remainingAmount` `0.1` and `0.2` return `openAmountByPair["EUR/USD"] === 0.3` (not `0.30000000000000004`); a pair sum whose 9th decimal digit is `5` is rounded up in the 8th decimal, and one whose 9th decimal digit is `4` is rounded down.

- **AC-16** — IF a `PENDING` input order has `currencyPair` `"__proto__"`, THEN the `summarizeOrders` helper shall return `openAmountByPair` with an own property `"__proto__"` equal to that pair's rounded `remainingAmount` sum, and shall leave `Object.prototype` unchanged.
  Verify: unit — a `PENDING` order with `currencyPair` `"__proto__"` and `remainingAmount` 10 yields `Object.prototype.hasOwnProperty.call(result.openAmountByPair, "__proto__") === true` with value `10`, `Object.keys(result.openAmountByPair)` contains `"__proto__"`, and after the call `Object.getOwnPropertyNames(Object.prototype)` is unchanged and `({}).hasOwnProperty("__proto__")` is still `false`.

## Edge cases

| ID | Case | Expected behaviour | Covered by |
|----|------|--------------------|------------|
| EC-1 | Empty array | Zero total, all statuses `0`, `openAmountByPair` `{}` | AC-9 |
| EC-2 | Only one status present in input | Other two statuses present with `0` | AC-4 |
| EC-3 | Pair with only `CANCELLED`/`FILLED` orders | Pair key absent from `openAmountByPair` | AC-7, AC-8 |
| EC-4 | Same pair, mixed statuses | Only `PENDING` `remainingAmount` summed | AC-6, AC-7 |
| EC-5 | Single `PENDING` order | `openAmountByPair` has exactly one key equal to its `remainingAmount` | AC-6 |
| EC-6 | Partially filled `PENDING` order (`remainingAmount < amount`) | `remainingAmount` is summed, not `amount` | AC-6 |
| EC-7 | Frozen / shared input (React state) | No mutation, no throw | AC-10 |
| EC-8 | Decimal amounts whose float sum drifts (e.g. `0.1 + 0.2`) | Pair sum rounded to 8 decimals, half-up on the 9th: `0.1 + 0.2` → `0.3` | AC-15 |
| EC-9 | `PENDING` order with `remainingAmount` `0`, negative, `null` or `NaN` (violates backend invariant `0 < remainingAmount <= amount` from `docs/features/manage-orders/data-model.md`) | Out of scope — summed as-is, output unspecified | NG-6 |
| EC-10 | `currencyPair` differing only by case or whitespace (e.g. `"eur/usd"`) | Treated as a distinct key — keys are compared exactly as given; backend enforces `^[A-Z]{3}/[A-Z]{3}$` | AC-6 |
| EC-11 | Unknown `status` string at runtime (not in `OrderStatus`) | Out of scope — the TypeScript type is the contract | NG-8 (AC-5 holds for type-conforming input) |
| EC-12 | Duplicate order objects / duplicate `id`s in input | Each array element counted as given; no de-duplication | AC-2 |
| EC-13 | Large input (10 000 orders) | Single linear pass; no time budget | NFR-1, NG-9 |
| EC-14 | `currencyPair` `"__proto__"` | Own key in `openAmountByPair`; `Object.prototype` untouched | AC-16 |

## Non-functional

- **NFR-1 Performance:** The helper makes a single pass over the input (linear in N), with no per-order sorting or I/O. No measurable time budget is required (NG-9). Not a behaviour-constraining requirement, so no AC; checked in code review.
- **NFR-2 Purity / reliability:** No mutation, no side effects, deterministic output — AC-10, AC-11, AC-12.
- **NFR-3 Numeric correctness:** Each pair sum in `openAmountByPair` is rounded to 8 decimal places (the `remainingAmount` scale in `data-model.md`), half-up on the 9th decimal — AC-15. Tests follow the project's monetary BVA rule (`.claude/rules/test-strategy.md` §3.2) for this rounding boundary.
- **NFR-4 Test effectiveness:** Risk class is *standard* per `.claude/rules/test-strategy.md` §1 — standard EP/BVA coverage, no mutation-testing gate (NG-10). Tests run in the existing `npm test` suite — AC-13.
- **Security:** Prototype-safe handling of `currencyPair` keys — AC-16. Otherwise N/A — no I/O, no code execution, no persistence.
- **Accessibility:** N/A — no UI changes (NG-1).
- **Privacy:** N/A — no data leaves the function; nothing is logged or stored.
- **Observability:** N/A — pure function, no logging (AC-12).

## Inputs (provenance)

| Input | Provenance |
|-------|------------|
| `orders: Order[]` | [reused: `Order` type, `frontend/src/types/order.ts`] — at runtime typically the array returned by `listOrders` in `frontend/src/api/orderApi.ts` (backend `GET /api/orders`), passed in by the caller |
| `OrderStatus` values `PENDING` / `CANCELLED` / `FILLED` | [reused: `OrderStatus` in `frontend/src/types/order.ts`] |
| `remainingAmount` semantics | [reused: `docs/features/manage-orders/data-model.md` — scale-8 decimal, `0 < value <= amount` while `PENDING`; legacy `null` resolved by backend read-path fallback to `amount`] |
| `currencyPair` format | [reused: backend validation `^[A-Z]{3}/[A-Z]{3}$` in `CreateOrderRequest`] |
| Rounding rule (8 decimals, half-up) | [user decision, CL-2] |
| Output | [deterministic: pure function of `orders`] |

## Untrusted inputs

The helper reads `currencyPair` strings that originate from user input (via the backend). They are used only as data — as object keys — never evaluated or rendered. Because the result is a plain object keyed by `currencyPair`, the helper does not rely on the backend regex to keep keys safe: a pair string `"__proto__"` must produce an own key and must not alter any prototype (AC-16). Other key strings are compared exactly as given (AC-6, EC-10).

## Notes from grounding

- The root `CLAUDE.md` still says orders only move `PENDING` → `CANCELLED` and that there is no "filled" state. The current code (`frontend/src/types/order.ts`) and `docs/features/manage-orders/data-model.md` already have `FILLED`, `remainingAmount` and `fillEvents`. This spec follows the code. Updating `CLAUDE.md` is outside this spec's write scope (a documentation follow-up for the user).

## Traceability

| Story | Goals | ACs | Edge cases | NFRs | Source |
|-------|-------|-----|------------|------|--------|
| US-1 | G-1, G-2, G-3, G-5 | AC-1, AC-2, AC-3, AC-4, AC-5, AC-9 | EC-1, EC-2, EC-11, EC-12 | NFR-1 | user text; CL-1, CL-4 answers |
| US-2 | G-4 | AC-6, AC-7, AC-8, AC-15, AC-16 | EC-3, EC-4, EC-5, EC-6, EC-8, EC-9, EC-10, EC-14 | NFR-3, Security | user text; `data-model.md`; CL-2, CL-3, CL-7 answers |
| US-3 | G-6 | AC-10, AC-11, AC-12 | EC-7 | NFR-2 | user text |
| US-4 | G-7 | AC-13 | EC-13 | NFR-4 | user text; `.claude/rules/test-strategy.md`; CL-5, CL-6 answers |
| — (Non-goals NG-1..NG-3) | — | AC-14 | — | — | user text |

Mandatory-requirement coverage: G-1 → AC-1; G-2 → AC-2; G-3 → AC-3, AC-4, AC-5; G-4 → AC-6, AC-7, AC-8, AC-15; G-5 → AC-9; G-6 → AC-10, AC-11; G-7 → AC-13; "only the frontend package is touched" → AC-14; NFR-3 → AC-15; Security (prototype-safe keys) → AC-16. NFR-1 has no number by user decision (NG-9) and NFR-4 imposes no gate (NG-10), so neither needs an AC. Every mandatory requirement has at least one AC.

## [NEEDS CLARIFICATION]

No open items. Resolution log:

| ID | Decision | Applied in |
|----|----------|------------|
| CL-1 | Confirmed: fields `total`, `byStatus`, `openAmountByPair`; `openAmountByPair` is a plain object `Record<string, number>`. | Contract, AC-1 |
| CL-2 | Round each pair's sum to 8 decimal places, half-up on the 9th decimal; example `0.1 + 0.2` → `0.3`. | G-4, AC-6, AC-15, EC-8, NFR-3 |
| CL-3 | Keep NG-6: invalid `remainingAmount` values are out of scope and summed as-is. | NG-6, EC-9 |
| CL-4 | Unknown status strings out of scope; the TypeScript type is the contract. AC-5 kept. | NG-8, AC-5, EC-11 |
| CL-5 | No time budget; a single linear pass is enough. | NFR-1, NG-9, EC-13 |
| CL-6 | Standard risk class; no mutation-testing gate. | NFR-4, NG-10 |
| CL-7 | Add the AC: `PENDING` order with `currencyPair` `"__proto__"` yields an own key, `Object.prototype` untouched. | AC-16, EC-14, Untrusted inputs, Security |
