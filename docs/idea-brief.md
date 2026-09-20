---
status: Draft
owner: "Marisha"
updated_at: "2026-09-12"
depth: "medium"
---

# Idea brief — manage-orders

## 1. Raw idea

the idea is to add one more screen where I can cancel, fill or amend order

## 2. Problem

Today, order entry and order management are conflated on one page: the entry form shares its screen with an inline order list whose only action is Cancel. There is no way to record that an order (or part of it) was filled, and no way to amend a pending order's price or amount without cancelling and recreating it.

## 3. Users

The same trader who places orders today — no new persona. They need to manage orders they already placed, not just create new ones.

## 4. Why now

No external trigger (no incident, deadline, or contract) — this is a natural next increment after order entry: once orders exist, the ability to act on them (not just create them) was always going to be needed.

## 5. Out of scope

- **Execution/matching engine** — fill is a manual status record, not a simulated or automated match against a price feed. Reason: stays inside the project's existing order-entry-only boundary.
- **Un-cancel** — cancellation is permanent, no restore path. Reason: keeps order lifecycle simple (PENDING → CANCELLED is terminal); confirmation on cancel is the safeguard instead.
- **Amending currency pair, side, or order type** — amend only touches trigger price and remaining amount. Reason: changing the instrument or direction of a resting order is conceptually a new order, not an edit.
- **Batch actions / filters / history tab** — considered as alternative screen shapes but deferred; single table with expandable rows covers today's scale. Reason: avoid building for volume that doesn't exist yet.

## 6. Risks

- **Weakest spot: fills are self-reported with no independent check.** Nothing stops recording a fill that couldn't actually have happened at that trigger price — there's no price feed or matching engine to validate against. Assumes the trader/ops recording fills is trustworthy; false if this ever needs to be audit-proof against manual error or misuse.
- Assumes amend on a partially-filled order should only ever touch the *remaining* amount, never the filled portion — false if a future need arises to correct a wrongly-recorded fill after the fact (no correction/reversal path exists for fills, same as cancel).
- Assumes fill-event history (full audit trail) is worth its extra build cost over a simple remaining-amount counter — this was a deliberate tradeoff for auditability; if that history is never actually consulted, it's cost without payoff.

## 7. Recommendation

Add a single "Manage Orders" screen, separate from order entry, showing all of the trader's orders in one table with per-row actions: Cancel (with a confirmation step, since it's irreversible), Fill (full or partial — each fill recorded as its own event with amount and timestamp, decrementing a remaining-amount field, auto-flipping status to FILLED at zero), and Amend (trigger price and/or remaining amount only, disabled once an order isn't PENDING, and always editing the remaining, not original, amount once fills exist). Rows expand to reveal fill history when present. The order entry page becomes create-only — its current inline list and Cancel button move here entirely.

## 8. Open questions

- Whether fill-event history needs to be surfaced anywhere beyond the expandable row (e.g. exported, or reviewed in aggregate) — owner: Marisha, revisit once real usage shows whether it's consulted.
- Whether a correction/reversal path for a wrongly-recorded fill or cancel will be needed later — owner: Marisha, deferred until it's actually hit.
