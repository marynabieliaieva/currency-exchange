---
id: T15
title: "Add a frontend test runner and e2e-through-UI tests for every action"
layer: "tests"
deps: ["T9", "T11", "T12", "T13", "T14"]
blocks: []
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08", "AC-09", "AC-10", "AC-12", "AC-13", "AC-14", "AC-15"]
files_hint: ["frontend/package.json", "frontend/vitest.config.ts", "frontend/src/pages/ManageOrdersPage.test.tsx", "frontend/src/pages/OrderEntryPage.test.tsx"]
owner: "Marisha"
estimate: "L"
context_budget: "L"   # justified: this task's DoD is "one e2e-through-UI test per AC" (14 of the 15 spec ACs), so its acs list and AC section are necessarily broad — splitting it would just move the same coverage list into several smaller files with no reduction in total context
status: "todo"
---

# T15 — Add a frontend test runner and e2e-through-UI tests for every action

## Place in the sequence

- **Blocked by:** T9 (entry page creation-only), T11 (Cancel dialogs), T12 (Fill dialog), T13 (Amend dialog), T14 (Fill trail) — every UI surface this task exercises must exist first. **Blocks:** none — last task in the frontend chain. **Wave:** 4.
- **Lane:** own lane — no `files_hint` overlap with any other task (introduces new test files, does not further modify `ManageOrdersList.tsx`).

## Why (user story)

> **As a** Trader
> **I want** the system to reject a fill that exceeds what's left on an order, and to never let a double-submitted fill overcount
> **So that** an order's remaining amount is always trustworthy, even when I make a mistake or double-click
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task is also the closer for the repo-gap sad.md §11 flagged: the frontend has no test runner at all today, and every UI-touching AC needs at least one automated check before the feature can be called done.

## Inlined context

> This feature is the first to need real test infrastructure: ... the frontend has no test runner at all. ... a frontend test runner + e2e-through-UI tooling before those §10 verifications can run — scope this as setup work in `tasks`, not assumed-available tooling.
>
> — `sad.md §11, Risks and technical debt row 5, abridged` · full text: [sad.md](../sad.md)

> **QG-2 Traceability of derived state — How verify:** a unit test on the fill/amend arithmetic plus an e2e-through-UI test that records two partial fills and confirms both appear in the expanded trail in order.
>
> — `sad.md §10, QG-2, verbatim` · full text: [sad.md](../sad.md)

> **QG-3 Zero-manual-edit completeness — How verify:** AC coverage via an e2e-through-UI test per action, confirming the action completes with no manual data-layer step.
>
> — `sad.md §10, QG-3, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [ux-flows.md](../ux-flows.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

No new API surface — tests exercise the endpoints T4/T8/T11/T12/T13 already wired (`GET/POST/PATCH/DELETE /api/orders...`), either against a running backend or a mocked `fetch`/MSW layer, whichever the chosen test runner supports most simply.

## Acceptance criteria

Every AC below gets at least one e2e-through-UI test (Given/When/Then quoted verbatim; the test asserts the Then).

### AC-01 — `spec.md §5, AC-01, verbatim`
**Given** a PENDING order with no fill events **When** the Trader confirms cancelling it **Then** the system marks it CANCELLED and confirms to the Trader.

### AC-02 — `spec.md §5, AC-02, verbatim`
**Given** a PENDING order that already has one or more fill events **When** the Trader attempts to cancel it **Then** the system tells the Trader how much has already been filled and requires an explicit second confirmation naming that cancelling permanently forfeits the remaining (unfilled) amount, before proceeding; once cancelled, status becomes CANCELLED and remaining amount is left unchanged.

### AC-03 — `spec.md §5, AC-03, verbatim`
**Given** a PENDING order with a remaining amount greater than zero **When** the Trader records a fill at or below the remaining amount **Then** the system records a new fill event, reduces the remaining amount, confirms to the Trader, and marks the order FILLED if remaining reaches zero.

### AC-04 — `spec.md §5, AC-04, verbatim`
**Given** a PENDING order with a remaining amount **When** the Trader attempts a fill that is zero, negative, or greater than the remaining amount **Then** the system rejects it, tells the Trader why, and leaves the remaining amount unchanged.

### AC-05 — `spec.md §5, AC-05, verbatim`
**Given** a PENDING order and two near-simultaneous fills whose combined amount would exceed the remaining amount **When** both are processed **Then** they are processed one at a time and the overfilling one is rejected in full, remaining amount never below zero. (Covered via the backend's T6 integration test; here, cover the UI's disabled-while-in-flight double-submit guard per US-05.)

### AC-06 — `spec.md §5, AC-06, verbatim`
**Given** a PENDING order **When** the Trader amends its trigger price and/or remaining amount to a new valid value **Then** the system updates the order and confirms the new values.

### AC-07 — `spec.md §5, AC-07, verbatim`
**Given** a PENDING order with one or more fill events **When** the Trader amends it **Then** the amend only ever changes the remaining amount within its bound, and the already-filled portion and its fill events are never altered.

### AC-08 — `spec.md §5, AC-08, verbatim`
**Given** an order with one or more recorded fill events **When** the Trader expands its row **Then** the system shows each fill event's amount and timestamp, oldest first.

### AC-09 — `spec.md §5, AC-09, verbatim`
**Given** the Manage Orders screen exists **When** the Trader opens the order entry page **Then** the system shows only the order creation form — no list, no Cancel action.

### AC-10 — `spec.md §5, AC-10, verbatim`
**Given** an order that is CANCELLED or FILLED **When** the Trader attempts to cancel, fill, or amend it **Then** the system rejects the action and tells the Trader the order is no longer open.

### AC-12 — `spec.md §5, AC-12, verbatim`
**Given** a PENDING order **When** the Trader attempts to amend its remaining amount above the allowed max, or to exactly zero **Then** the system rejects the amend and explains the allowed range.

### AC-13 — `spec.md §5, AC-13, verbatim`
**Given** a PENDING order and two different near-simultaneous actions **When** both are processed **Then** they apply one at a time so the order never ends up inconsistent. (Covered via the backend's T6 integration test; here, cover that the UI surfaces the race-loss rejection correctly.)

### AC-14 — `spec.md §5, AC-14, verbatim`
**Given** orders in every status **When** the Trader opens the Manage Orders screen **Then** all are listed, with Cancel/Fill/Amend enabled only on PENDING and disabled on CANCELLED/FILLED.

### AC-15 — `spec.md §5, AC-15, verbatim`
**Given** the Trader is on either screen **When** they want to switch **Then** each is reachable at its own distinct address.

— full text for all: [spec.md](../spec.md) §5

## Checklist

- [ ] Add a test runner + Testing Library to `frontend/package.json` (e.g. Vitest + `@testing-library/react`, matching the existing Vite toolchain) and a `test` npm script
- [ ] `frontend/vitest.config.ts` (or equivalent) wired to the existing Vite config
- [ ] `OrderEntryPage.test.tsx` — covers AC-09 (creation-only, no list/Cancel) and the create-success banner
- [ ] `ManageOrdersPage.test.tsx` — covers AC-14 (mixed-status list, gated buttons), AC-01/AC-02 (cancel + forfeiture), AC-03/AC-04 (fill happy path + rejections), AC-06/AC-07/AC-12 (amend happy path + rejections), AC-08 (expand fill trail), AC-10 (closed-order rejection surfaced in the UI)
- [ ] A routing test (can live in either file, or a small `App.test.tsx`) covers AC-15 — both routes render their page, nav link switches between them
- [ ] Mock the `orderApi.ts` calls (or run against a lightweight fetch mock) rather than requiring a live backend for these tests

## Edge cases

| Case | Behaviour |
|---|---|
| A test needs to simulate the AC-05/AC-13 server-side race | Mock the API response as the rejection the server would return (`409 order.fill_exceeds_remaining` / `order.not_pending`) rather than trying to genuinely race two requests client-side — genuine concurrency is T6's job, not this task's |
| No live backend available in CI | All tests run against a mocked `orderApi.ts`/`fetch`, not a live `mvn spring-boot:run` |

## Definition of Done

- [ ] `npm test` runs and every AC-0X test above passes
- [ ] the frontend has a working test runner wired into `npm test` where none existed before
- [ ] lint clean
