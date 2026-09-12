---
id: T9
title: "Make the order entry page creation-only"
layer: "ui"
deps: ["T7"]
blocks: ["T15"]
acs: ["AC-09"]
files_hint: ["frontend/src/pages/OrderEntryPage.tsx", "frontend/src/App.tsx"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T9 — Make the order entry page creation-only

## Place in the sequence

- **Blocked by:** T7 — Introduce react-router and split App.tsx into two routed page shells (needs `OrderEntryPage` to exist as its own route). **Blocks:** T15 — Frontend e2e tests (covers AC-09). **Wave:** 2 (frontend chain).
- **Lane:** own lane — no `files_hint` overlap with any other task (`ManageOrdersList.tsx`, the shared file for T10–T14, is not touched here).

## Why (user story)

> **As a** Trader
> **I want** the order entry page to only handle creating new orders
> **So that** creating and managing orders don't clutter or duplicate the same screen
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task removes the inline order list and Cancel button that used to live on the entry page — that responsibility now belongs entirely to the Manage Orders screen (T10).

## Inlined context

> `components/` OrderEntryForm (existing, unchanged), OrderList.tsx (removed — its inline list + Cancel button are what AC-09 requires off the entry page)
>
> — `sad.md §5, Internal decomposition (frontend/src/), abridged` · full text: [sad.md](../sad.md)

> | default | Screen opened; form empty/reset | LabeledInput, Select, SubmitButton | wireframe below |
> | success | Order created — AC-09 removed the list that used to make this visible implicitly, so an explicit confirmation is now required | NEW: InlineStatusBanner (success variant) | wireframe below |
> | empty | N/A: creation-only screen has no list to be empty (AC-09) | — | — |
>
> — `screens.md §SCR-01 Order entry page, state table, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no new API surface. Continues to call the existing `createOrder` from `orderApi.ts` (unchanged).

## Acceptance criteria

### AC-09 — happy path

> **Given** the Manage Orders screen exists
> **When** the Trader opens the order entry page
> **Then** the system shows only the order creation form — no list of existing orders and no Cancel action appear there
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Remove `OrderList` import/usage and any order-list state (`orders`, refetch-after-cancel) from the entry page — `frontend/src/pages/OrderEntryPage.tsx`, `frontend/src/App.tsx`
- [ ] Delete `frontend/src/components/OrderList.tsx` (its Cancel button and list rendering are fully superseded by T10's `ManageOrdersList`)
- [ ] Add an inline success confirmation banner (`SCR-01` `success` state — new `InlineStatusBanner` success variant, or an equivalent minimal inline text) shown after a successful create, since there is no longer a list to make success implicitly visible
- [ ] Keep `OrderEntryForm` and its existing client-side validation unchanged

## Edge cases

| Case | Behaviour |
|---|---|
| Order created successfully | Success banner shown inline on `OrderEntryPage`; no navigation, no list update (there is no list here) |
| Validation error on submit (existing `OrderEntryForm` behavior) | Unchanged — existing `.form-error` inline text |

## Definition of Done

- [ ] `OrderEntryPage` renders only the creation form plus success/validation-error banners — no order list, no Cancel button anywhere on this route
- [ ] `OrderList.tsx` deleted, no remaining references to it
- [ ] `npm run build` passes
- [ ] lint clean
