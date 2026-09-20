---
status: Accepted
owner: "Marisha"
reviewers: []
updated_at: "2026-09-12"
feature_size: "S"
ticket: "manage-orders"
---

# 0002 — Introduce react-router for order-entry / manage-orders navigation

- **Status:** Accepted
- **Date:** 2026-09-12
- **Deciders:** Marisha (Architect), during the `design` Socratic walk

## Context

AC-15 requires the order entry page and the new Manage Orders screen to each be reachable at their own distinct URL, so the Trader can navigate directly to either. The frontend today (`frontend/src/App.tsx`) is a single page with no routing library in `package.json` — `App.tsx` owns all state directly and renders the form and list together. manage-orders also removes the inline order list and Cancel button from the entry page (AC-09), so the two concerns need to become two separately addressable screens.

## Decision drivers

- AC-15 (distinct, directly-navigable URLs for the two screens) — a hard functional requirement, not a style preference.
- AC-09 (entry page becomes creation-only) — the two screens' responsibilities diverge, reinforcing that they should be separate routes rather than a mode-switch on one page.
- ux-flows.md's platform decision: responsive-both, single-list-view interaction pattern (dialogs launched from the row) — routing only needs to separate the two top-level screens, not model nested state within either.

## Considered options

1. **Introduce `react-router-dom`** — `App.tsx` becomes a thin router shell with two routes (`/` → order entry, `/manage-orders` → Manage Orders), each rendering its own page component.
2. **Manual URL handling via the History API** — hand-roll `window.location` + `pushState` matching for the two routes, no new dependency.
3. **Separate Vite multi-page entry points** — configure Vite's multi-page build (`entry.html`, `manage.html`) so each screen is its own HTML entry and JS bundle.

## Decision outcome

**Chosen:** Option 1. It is the standard, well-understood way to give a React SPA multiple addressable screens, handles back/forward navigation and active-link state for free, and leaves room to add more screens later without revisiting the navigation mechanism. Option 2 would re-implement (and get subtly wrong) the same navigation primitives a router already solves. Option 3 produces two separate bundles with duplicated build/dev-server wiring for what is, and is expected to remain, a two-screen app sharing one API client and type layer — disproportionate for the current scope.

## Consequences

**Positive**
- AC-15 is satisfied directly: each screen has a real, bookmarkable, directly-navigable URL.
- Adding a third screen later (if ever) is a one-line route addition, not a re-architecture.
- Browser back/forward and a "New Order" / "Manage Orders" nav link both come from the router for free.

**Negative**
- A new runtime dependency (`react-router-dom`) is added to a frontend that currently has none beyond `react`/`react-dom`.
- `App.tsx`'s current single-state-owner structure needs a small restructuring (state currently fetched/held in `App.tsx` moves to whichever page component owns it, or a shared layout).

**Neutral**
- Switching to a different routing approach later remains possible but would touch every route-aware component; not expected to be revisited absent a major frontend rework.

## Links

- Spec: [[../spec.md]] — AC-09, AC-15
- SAD: [[../sad.md]] §4, §5
- Related ADR: none
