# Implementation Plan: Order summary helper (`summarizeOrders`)

## Context
- Spec: `specs/2026-10-23-order-summary/spec.md` (SPEC-01, Status: approved, no open `[NEEDS CLARIFICATION]` items — CL-1…CL-7 resolved)
- Execution mode: single-agent (decided by the user up front)
- Modules touched: `frontend/` only — two new files, `frontend/src/utils/orderSummary.ts` and `frontend/src/utils/orderSummary.test.ts`. The folder `frontend/src/utils/` does not exist yet; this task creates it.
- CLAUDE.md / AGENTS.md / INSIGHTS.md consulted: root `CLAUDE.md`, `.claude/rules/test-strategy.md`. There is no `frontend/CLAUDE.md`, no `AGENTS.md` and no `INSIGHTS.md` anywhere in the repo. There is no project `.claude/skill-routing.md`, so the default routing map applies with `<frontend>` = `frontend/` (React package).
- Check commands (all run from `frontend/`; given by the user, matching `frontend/package.json`, where `"test": "vitest run"` and `"build": "tsc -b && vite build"`):
  - typecheck: `npx tsc -b` (`tsconfig.json` `include: ["src"]`, so test files are type-checked too; `strict`, `noUnusedLocals`, `noUnusedParameters` are on)
  - targeted tests: `npx vitest run <files>`
  - related tests: none needed. The new module has no existing importers.
  - lint: none (no lint script in `package.json`)
  - full suite (final verification only): `npm test`
- Architectural constraints (from `frontend-ui-architecture` digest and spec):
  - A pure calculation lives in a plain function module, not in a component or hook. `src/utils/orderSummary.ts` is split by concern ("order summary"). It is not a junk-drawer `utils.ts`, and it has no barrel `index.ts`.
  - The helper consumes `Order` / `OrderStatus` from `src/types/order.ts` as they are. It never redefines or modifies them.
  - Test environment: Vitest 2, `jsdom`, `globals: true`, setup `src/test/setup.ts`. Existing tests import `describe/it/expect` explicitly from `"vitest"`. Follow that.
- Confirmed requirements / decisions:
  - Single-agent mode; code in `frontend/src/utils/orderSummary.ts`, Vitest tests next to it; check commands as listed above (user, in the request).
  - Everything else comes from the approved spec. No further questions were needed: the spec resolves contract shape (CL-1), rounding (CL-2), invalid amounts (CL-3), unknown statuses (CL-4), performance (CL-5), risk class (CL-6) and `__proto__` keys (CL-7).

## Recommendations
These are proposals. The session was non-interactive, so they could not be confirmed. Each one is about *how* to build the feature, not *what* it does, and the plan stays valid whether you accept or reject it.
- proposed: **Do not round with `Math.round(x * 1e8) / 1e8` or `Number(x.toFixed(8))`.** I checked in Node 20 during planning: the naive approach gives `0.000000015 → 0.00000001` and `1.234567885 → 1.23456788`, and `toFixed` gives `0.123456785 → 0.12345678`. All three are wrong under half-up. Collapsing float noise to 15 significant digits before and after the shift gives correct results for every probe value: `Math.round(Number((Number(sum.toPrecision(15)) * 1e8).toPrecision(15))) / 1e8`. Trade-off: one line less obvious than the naive version; needs a short comment.
- proposed: **Accumulate in a local `Map<string, number>` and build `openAmountByPair` at the end with `Object.defineProperty(result, pair, { value, enumerable: true, writable: true, configurable: true })`.** This makes `"__proto__"` an own data property of a normal `{}` (AC-16) while the prototype stays `Object.prototype`, so `toEqual({})` in AC-9 behaves as expected. Trade-off: slightly more code than `Object.create(null)`, but `Object.create(null)` would make the result a non-plain object, which breaks the "plain object" reading of AC-1.
- proposed: **Use a small local `makeOrder(overrides: Partial<Order>): Order` factory in the test file**, so every case stays type-conforming (AC-1, AC-5) without repeating ten fields. Trade-off: none worth noting.

## Test strategy
Risk class: *standard* (spec NFR-4, NG-10). That means EP/BVA coverage, no mutation gate, and monetary BVA on the rounding boundary (test-strategy §3.2). All tests are unit level in one file.

| Spec AC | Level | Test file | Task |
|---|---|---|---|
| AC-1 (shape, plain object, compiles) | unit + typecheck | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-2 (total for 1 and 5 orders; duplicates counted, EC-12) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-3 (2/1/3 status split) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-4 (only FILLED → other keys `0`, present) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-5 (status counts sum to total for every test input) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-6 (per-pair PENDING sum; EC-5, EC-6, EC-10) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-7 (CANCELLED/FILLED excluded) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-8 (pair without PENDING absent, not `0`) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-9 (empty array) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-10 (deep-frozen input, no throw, deep-equals a pre-call `structuredClone`) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-11 (deterministic, no shared references) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-12 (no I/O; type-only imports) | unit (no `fetch` mock) + static check in Final verification | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-13 (tests exist; full suite green) | suite run | — (Final verification) | orchestrator |
| AC-14 (no file outside the two new files) | static check | — (Final verification) | orchestrator |
| AC-15 (round pair total half-up to 8 dp; BVA) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |
| AC-16 (`"__proto__"` own key, prototype untouched) | unit | `frontend/src/utils/orderSummary.test.ts` | T1 |

## Tasks

### Task T1: Implement `summarizeOrders` with its Vitest unit tests
- Agent: implementer
- Requirement-ID: SPEC-01 AC-1 … AC-12, AC-15, AC-16 (G-1 … G-7)
- Depends-on: none
- Owned paths: [`frontend/src/utils/orderSummary.ts`, `frontend/src/utils/orderSummary.test.ts`]
- Skills to apply: [`frontend-ui-architecture` (digest), `security` (digest — untrusted `currencyPair` used as object keys), `react-testing-library` (digest — test file only; no rendering needed)]
- Key constraints:
  - Signature: `export function summarizeOrders(orders: readonly Order[]): OrderSummary`. Also export `type OrderSummary = { total: number; byStatus: Record<OrderStatus, number>; openAmountByPair: Record<string, number> }`. Field names must be exactly `total`, `byStatus` and `openAmountByPair` (CL-1). `readonly Order[]` still accepts `Order[]`.
  - The module's only import is `import type { Order, OrderStatus } from "../types/order";`. It must contain no runtime imports, no `console`, no `fetch`, no timers, no `globalThis`/`window`/`localStorage` access, and no module-level mutable state (AC-12).
  - Do one linear pass over `orders`, with no sorting (NFR-1). Never write to the input array, to any `Order`, or to `fillEvents`. Avoid `sort`, `reverse`, `splice` and assignment on elements (AC-10). Every returned object (`result`, `byStatus`, `openAmountByPair`) is freshly created (AC-11).
  - `byStatus` starts as `{ PENDING: 0, CANCELLED: 0, FILLED: 0 }` and is incremented with `byStatus[o.status] += 1`. Do not add guards for unknown statuses. They are out of scope (NG-8).
  - `openAmountByPair`: sum `remainingAmount` (never `amount`, EC-6) only for `status === "PENDING"`. Compare keys exactly as given, with no trimming or case folding (EC-10). Do not validate or clamp amounts. Sum invalid values as they are (NG-6). Do not convert currencies (NG-5).
  - Prototype safety (AC-16): never do `obj[pair] = …` or `obj[pair] += …` on a normal object. Accumulate in a `Map<string, number>`, then copy into a fresh `{}` with `Object.defineProperty(..., { value, enumerable: true, writable: true, configurable: true })`. The result's prototype stays `Object.prototype`, and it is never a `Map` (AC-1).
  - Rounding (AC-15): round each pair's **total** once, never the individual addends, to 8 decimals, half-up on the 9th. Naive `Math.round(x*1e8)/1e8` and `toFixed(8)` are wrong for this (see Recommendations). Use the precision-collapsing form, or an equivalent that passes the BVA cases below, with a one-line comment explaining why.
  - Tests: import `describe/it/expect` from `"vitest"`. Use a local `makeOrder(overrides)` factory that returns a full `Order`. Mock nothing: no `vi.mock`, no `fetch` stub. Assert behaviour (outputs), not implementation details. Do not touch `src/test/setup.ts` or any other file.
  - Do not modify `src/types/**`, `src/components/**`, `src/pages/**`, `src/api/**`, `backend/**`, `CLAUDE.md`, the lock file or the spec (AC-14, NG-1…NG-4).
- Acceptance criteria (each is at least one `it(...)` in `orderSummary.test.ts`):
  - AC-1: `Object.keys(result).sort()` equals `["byStatus","openAmountByPair","total"]`; `result.openAmountByPair instanceof Map` is `false`; `Object.getPrototypeOf(result.openAmountByPair) === Object.prototype`; and the test calls the helper with a value typed `Order[]` (checked by `npx tsc -b`).
  - AC-2: 1 order gives `total === 1`. 5 orders with mixed statuses give `total === 5`. An array holding the same order object twice gives `total === 2` (EC-12).
  - AC-3: 2 PENDING, 1 CANCELLED and 3 FILLED give `byStatus` deep-equal to `{ PENDING: 2, CANCELLED: 1, FILLED: 3 }`.
  - AC-4: input with only FILLED orders gives `byStatus.PENDING === 0` and `byStatus.CANCELLED === 0`, and `"PENDING" in byStatus` and `"CANCELLED" in byStatus` are both `true`.
  - AC-5: a shared helper asserts `PENDING + CANCELLED + FILLED === total` for every input used in the AC-2, AC-3, AC-4 and AC-9 tests.
  - AC-6: PENDING EUR/USD 100 + 250 and PENDING GBP/USD 40 give `{ "EUR/USD": 350, "GBP/USD": 40 }`. A single PENDING order gives exactly one key (EC-5). A partially filled PENDING order (`amount` 1000, `remainingAmount` 400) contributes 400 (EC-6). `"eur/usd"` and `"EUR/USD"` are two distinct keys (EC-10).
  - AC-7: CANCELLED EUR/USD 500 + PENDING EUR/USD 100 give `"EUR/USD": 100`. A FILLED order on the same pair is also excluded.
  - AC-8: only CANCELLED/FILLED USD/JPY orders give `"USD/JPY" in result.openAmountByPair === false`.
  - AC-9: `summarizeOrders([])` deep-equals `{ total: 0, byStatus: { PENDING: 0, CANCELLED: 0, FILLED: 0 }, openAmountByPair: {} }`, and `Object.keys(openAmountByPair).length === 0`.
  - AC-10: the input contains several orders with non-empty `fillEvents`. The test takes `structuredClone` first, then recursively `Object.freeze`s the array, each `Order`, each `fillEvents` array and each `FillEvent`. The call does not throw (test modules are ESM, so strict mode applies), and afterwards the input deep-equals the clone. Length, order and element identities (`toBe` per index) are unchanged.
  - AC-11: two calls on the same array deep-equal each other. Mutating the first result's `byStatus.PENDING` and `openAmountByPair[...]` changes neither the second result nor the input. `result.byStatus !== result2.byStatus`.
  - AC-12: the test file contains no `vi.mock`, `vi.fn` or `fetch` stub, and the tests pass. The type-only-import rule is checked statically in Final verification.
  - AC-15 (monetary BVA, each a PENDING pair sum):
    - `0.1 + 0.2` gives exactly `0.3`.
    - 9th-decimal `5` rounds up: `0.000000015` (single order) gives `0.00000002`, `1.234567885` gives `1.23456789`, and `0.000000005 + 0.00000001` gives `0.00000002`.
    - 9th-decimal `4` rounds down: `0.000000014` gives `0.00000001`, `1.234567884` gives `1.23456788`.
    - The smallest unit stays exact: `0.00000001` gives `0.00000001`.
    - The total is rounded, not each addend: `0.000000004 + 0.000000004` gives `0.00000001` (per-addend rounding would give `0`).
    - Integer sums are unchanged: `100 + 250` gives `350`.
  - AC-16: a PENDING order with `currencyPair` `"__proto__"` and `remainingAmount` 10 gives `Object.prototype.hasOwnProperty.call(result.openAmountByPair, "__proto__") === true`, `Object.getOwnPropertyDescriptor(result.openAmountByPair, "__proto__")?.value === 10`, and `Object.keys(result.openAmountByPair)` contains `"__proto__"`. `Object.getOwnPropertyNames(Object.prototype)` equals its pre-call snapshot, and `({}).hasOwnProperty("__proto__") === false`.
- Done-condition (from `frontend/`, both green):
  - `npx tsc -b`
  - `npx vitest run src/utils/orderSummary.test.ts`

## Final verification (run once by the orchestrator, not by any task)
Run from `frontend/`:
- `npx tsc -b`
- `npm test`: exit code 0. The report lists `src/utils/orderSummary.test.ts`, and `App.test.tsx`, `pages/ManageOrdersPage.test.tsx` and `pages/OrderEntryPage.test.tsx` still pass (AC-13).
- `grep -n "^import" src/utils/orderSummary.ts`: every printed line starts with `import type` (AC-12).
- From the repo root: `git status --porcelain --untracked-files=all`. Excluding the pre-existing `specs/` and this `docs/plans/order-summary.md`, it lists only `frontend/src/utils/orderSummary.ts` and `frontend/src/utils/orderSummary.test.ts` (AC-14). `tsc -b` may rewrite `frontend/tsconfig.tsbuildinfo`; if that file shows up, it is a build artefact, not a change.
- No UI or e2e flow changed, so there is no e2e run.

## Out of scope / deferred
- Wiring `summarizeOrders` into any component or page (NG-1).
- Backend, API, types and contract changes (NG-2 … NG-4).
- Validation of invalid `remainingAmount` values or unknown statuses (NG-6, NG-8).
- Mutation testing (NG-10) and performance benchmarks (NG-9).
- Updating root `CLAUDE.md`, which still says there is no `FILLED` state (spec "Notes from grounding").

## Open questions
- **Test-ownership protocol (owner: user).** `.claude/rules/test-strategy.md` §4 routes test authoring to `@frontend-tester` and requires `@test-reviewer` as the final gate. This plan has one `implementer` write both the helper and its tests, as the spec and the request ask (tests "next to it", one task). Decide whether to also run `@test-reviewer` on `orderSummary.test.ts` after implementation.
- **Stale `CLAUDE.md` (owner: user).** It describes only `PENDING → CANCELLED`, while the code has `FILLED`, `remainingAmount` and `fillEvents`. This is a documentation follow-up outside this plan's scope.

## Red flags
- Floating-point rounding is the main trap. If the AC-15 BVA tests are written to match whatever a naive `Math.round(x*1e8)/1e8` returns, they will encode the wrong values (`0.000000015 → 0.00000001`). The expected values in the AC list above are the correct half-up results; do not change them to fit the code.
- `obj["__proto__"] = n` on a plain object silently does nothing visible: it does not create an own key, and the AC-16 test catches this. `Object.create(null)` passes AC-16 but changes the object's prototype. Stick with `{}` + `Object.defineProperty`.
- A deep-freeze helper must also freeze `fillEvents` arrays and the `FillEvent` objects, or AC-10 proves less than it claims.
- `npx tsc -b` type-checks the test file. Unused imports or variables fail the build (`noUnusedLocals`), so keep the test file clean.
