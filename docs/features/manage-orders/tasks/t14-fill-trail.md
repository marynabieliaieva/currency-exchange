---
id: T14
title: "Build the expandable fill trail row"
layer: "ui"
deps: ["T10"]
blocks: ["T15"]
acs: ["AC-08"]
files_hint: ["frontend/src/components/FillTrail.tsx", "frontend/src/components/ManageOrdersList.tsx"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T14 — Build the expandable fill trail row

## Place in the sequence

- **Blocked by:** T10 — Build the Manage Orders list screen (needs the row's expand affordance to attach to). **Blocks:** T15 — Frontend e2e tests (covers AC-08). **Wave:** 3 (frontend chain, parallel with T11/T12/T13).
- **Lane:** shares `frontend/src/components/ManageOrdersList.tsx` with T11, T12, T13 — `implement` serializes these four against each other on that file.

## Why (user story)

> **As a** Trader
> **I want** to see the individual fills recorded against an order
> **So that** I can trust how its remaining amount was derived
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

## Inlined context

> Trader->>Web: expands a row with recorded fill events
> Web-->>Trader: fill events shown, oldest first (amount + timestamp each)
>
> — `sad.md §6, «Critical flow 5: View the order list and an order's fill trail» steps, abridged` · full text: [sad.md](../sad.md)

> | default | Row expanded on an order with ≥ 1 recorded fill event | NEW: FillTrailPanel (reuses OrderTable row styling) | wireframe below |
> | empty | N/A: the expand control only appears on rows that already have ≥ 1 fill event — there is nothing to expand into on a zero-fill row | — | — |
> | loading | N/A: `fillEvents` ships embedded in the same `Order` object already fetched for SCR-02's list — expand is a pure client-side toggle, no separate request | — | — |
>
> — `screens.md §SCR-07 Expanded fill trail, state table, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes — reads the `fillEvents` array embedded in the already-fetched `Order` (T1/T4), no separate query.

## API contract

Internal — no separate API call. `fillEvents` is already part of the `Order` object `GET /api/orders` returns (T10's fetch).

## Acceptance criteria

### AC-08 — happy path

> **Given** an order with one or more recorded fill events
> **When** the Trader expands that order's row on the Manage Orders screen
> **Then** the system shows each fill event's amount and timestamp, oldest first
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `FillTrail` — renders a list of `fillEvents` (amount + formatted timestamp), oldest first (no client-side re-sort needed — the server already preserves insertion order) — `frontend/src/components/FillTrail.tsx`
- [ ] Wire the expand control in `ManageOrdersList` (shown only on rows with `fillEvents.length > 0`) to toggle `FillTrail` inline under that row — `frontend/src/components/ManageOrdersList.tsx`
- [ ] Toggle is a pure client-side state change — no network request on expand/collapse
- [ ] No expand control rendered on rows with zero fill events

## Edge cases

| Case | Behaviour |
|---|---|
| Order has zero fill events | No expand control shown at all (not a disabled one) |
| Order has many fill events | All shown, oldest first, no pagination/truncation (out of scope per spec §3 non-goals) |
| Row collapsed then re-expanded | Same data, no re-fetch — it's the same in-memory `Order` object from the list fetch |

## Definition of Done

- [ ] expanding a row with ≥1 fill event shows each fill's amount + timestamp, oldest first (AC-08)
- [ ] no expand control on zero-fill rows
- [ ] expand/collapse triggers no network request
- [ ] `npm run build` passes
- [ ] lint clean
