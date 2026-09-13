# Changelog — manage-orders

## manage-orders — Cancel, Fill, and Amend for pending orders, with a visible fill trail

**What:** A new Manage Orders screen (`/manage-orders`) lets the Trader cancel, record a fill
against, or amend any pending order directly from the UI — no more manual database edits. Every
fill is individually recorded and visible per order (expand a row to see the fill trail, oldest
first), so the Trader can always explain how an order's remaining amount was derived. The order
entry page (`/`) is now creation-only: its old inline order list and Cancel button are gone.

**Why:** Order entry alone only let the Trader create orders — there was no way to record a
partial/full execution or correct a price/amount without cancelling and recreating. See
[spec](../spec.md) §1/§2. Two key decisions shape the implementation:
[ADR-0001](../adr/0001-atomic-conditional-update-for-order-actions.md) — cancel/fill/amend are each
a single atomic `findOneAndUpdate` guarded at the data layer, so two concurrent actions on the same
order can never leave it inconsistent (AC-05, AC-13), with no transactions/replica-set required —
and [ADR-0002](../adr/0002-introduce-react-router-for-screen-navigation.md) — the two screens are
now separate `react-router-dom` routes so each has its own directly-navigable URL (AC-15).

**How to use:**
- `POST /api/orders/{id}/fills` with `{"amount": 250.0}` records a fill; the response's
  `remainingAmount` and `status` (auto-flips to `FILLED` at zero) reflect it immediately.
- `PATCH /api/orders/{id}` with `{"triggerPrice": 1.09, "remainingAmount": 500}` (either field, or
  both) amends a pending order — the allowed `remainingAmount` range is `(0, amount − already-filled]`.
- `DELETE /api/orders/{id}` cancels; if the order already has fills, the UI requires an explicit
  second "forfeit the remainder" confirmation before calling it.
- See [openapi.yaml](../contracts/openapi.yaml) for the full request/response/error shapes.

**Operational notes:**
- Migration: none — no schema migration; a pre-feature order with no `remainingAmount`/`fillEvents`
  ever recorded is treated as if it had zero fills (its full `amount` as remaining) on every read
  and write path, with no backfill required.
- Feature flag / config: none.
- Rollback: revert the deploy. No data migration to reverse; pending orders untouched by this
  feature's actions are unaffected.

**Acceptance criteria delivered:** AC-01 through AC-15 — cancel (with and without a forfeiture
confirmation), fill (including the zero/negative/overfill rejection and the concurrent-fill race
guard), amend (including the amend-ceiling and concurrent-race guards), the per-order fill trail,
the creation-only entry page, the closed-order rejection guard, the legacy-order remaining-amount
fallback, and the two screens each reachable at their own URL.
