---
id: T7
title: "Introduce react-router and split App.tsx into two routed page shells"
layer: "wiring"
deps: []
blocks: ["T9", "T10"]
acs: ["AC-15"]
files_hint: ["frontend/package.json", "frontend/src/App.tsx", "frontend/src/pages/OrderEntryPage.tsx", "frontend/src/pages/ManageOrdersPage.tsx"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T7 — Introduce react-router and split App.tsx into two routed page shells

## Place in the sequence

- **Blocked by:** none — independent of the backend chain. **Blocks:** T9 — Make the order entry page creation-only; T10 — Build the Manage Orders list screen (both need the routed page shells to exist). **Wave:** 1 (can start immediately, in parallel with T1–T6 and T8).
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

> **As a** Trader
> **I want** the order entry page to only handle creating new orders
> **So that** creating and managing orders don't clutter or duplicate the same screen
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task is the navigation shell (AC-15) that makes it possible to give the entry page and the Manage Orders screen their own URLs — the content split itself is T9/T10.

## Inlined context

> **Introduce react-router for screen navigation** (ADR-0002) — `App.tsx` becomes a thin router shell with two routes so the entry page and Manage Orders each get their own URL (AC-15), replacing the current router-less single page. Chosen over hand-rolled History-API routing or separate Vite multi-page bundles as the standard, least-surprising way to give a two-screen SPA real navigation.
>
> — `sad.md §4, Solution strategy point 3, verbatim` · full text: [sad.md](../sad.md)

> `App.tsx` thin router shell (ADR-0002): routes "/" and "/manage-orders"
> `pages/` OrderEntryPage (creation-only, AC-09), ManageOrdersPage (new)
>
> — `sad.md §5, Internal decomposition (frontend/src/), abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [adr/0002-introduce-react-router-for-screen-navigation.md](../adr/0002-introduce-react-router-for-screen-navigation.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-15 — happy path

> **Given** the Trader is on either the order entry page or the Manage Orders screen
> **When** they want to switch between the two
> **Then** each is reachable at its own distinct address, so the Trader can navigate directly to either one
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `react-router-dom` to `frontend/package.json` dependencies
- [ ] Create `frontend/src/pages/OrderEntryPage.tsx` as a stub rendering the existing `OrderEntryForm` (content build-out is T9)
- [ ] Create `frontend/src/pages/ManageOrdersPage.tsx` as a stub (content build-out is T10)
- [ ] Rewrite `App.tsx` as a thin router shell: `<BrowserRouter>` with routes `/` → `OrderEntryPage`, `/manage-orders` → `ManageOrdersPage`, plus a nav link between the two visible on both routes
- [ ] `npm run build` (`tsc -b && vite build`) passes

## Edge cases

| Case | Behaviour |
|---|---|
| Direct navigation to `/manage-orders` (not via the nav link) | Renders `ManageOrdersPage` directly — this is exactly what AC-15 requires |
| Unknown path | Not specified by any AC — a simple fallback (e.g. redirect to `/`) is acceptable; do not over-build a 404 page |

## Definition of Done

- [ ] `/` renders `OrderEntryPage`, `/manage-orders` renders `ManageOrdersPage`, both reachable directly by URL
- [ ] nav link switches between them
- [ ] `npm run build` passes
- [ ] lint clean
