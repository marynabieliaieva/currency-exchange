---
status: Draft
owner: "Marisha"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-12"
feature_size: "S"
---

# Spec — manage-orders

> **Glossary:** [CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** None beyond the interview, `docs/idea-brief.md`, and the ideation suite (researcher/strategist/analyst/devils-advocate) — no additional reference module, doc, or KB channel was selected.

## 1. Context

Today, order entry and order management are conflated on one screen: the entry form shares its page with an inline order list whose only action is Cancel. There is no way for the Trader to record that an order (or part of it) was executed, and no way to adjust a pending order's price or amount without cancelling and recreating it — both currently require a manual database edit.

There is no external trigger (no incident, deadline, or contract) — this is the natural next increment after order entry: once orders exist, the ability to act on them, not just create them, was always going to be needed.

The committed approach (Approach C — Actions Screen with Visible Fill Trail, chosen over a bare actions-only screen and a full lifecycle-ledger screen): a dedicated Manage Orders screen with Cancel/Fill/Amend actions per order, plus a lightweight visible list of fill events per order so the Trader can trust how its remaining amount was derived — without building a full amend-history/audit view.

Traceability: this extends the existing layered pattern from the order-entry feature (`Order` → `OrderRepository` → `OrderService` → `OrderController`, with `CreateOrderRequest`-style DTO validation) rather than introducing a new one.

- **Decision override:** §5 carries no dedicated *authorization*-type acceptance criterion — rationale: this app has no login, accounts, or ownership model anywhere in the codebase; introducing one is out of scope for a feature whose brief is "add a screen to cancel/fill/amend orders." Confirmed with the Trader during the deep-dive (see §8 for the standing gap this leaves).

## 2. Goals

- The Trader can cancel, fill, or amend any of their pending orders entirely from the UI, with zero manual database edits.
- Every fill — full or partial — is individually visible, so the Trader can always explain how an order's remaining amount was derived without inspecting raw data.
- Order state changes stay consistent even under rapid or duplicate action requests (e.g. a double-click never corrupts an order's remaining amount).
- The order entry page shows creation only — its current inline order list and Cancel button are fully removed once Manage Orders exists.

## 3. Non-goals

- **No execution/matching engine.** Fills stay a manual, self-reported record — not a simulated or automated match against a price feed. Reason: stays inside the project's existing order-entry-only boundary; adding real execution is a separate, much larger feature.
- **No amend-history or audit trail of past amendments.** Only an order's current state (price, remaining amount) is visible — not a log of what it used to be. Reason: Approach C deliberately accepts this gap to avoid the build cost of a full lifecycle ledger (Approach B) for a single-user tool with no compliance driver.
- **No correction or reversal path for a wrongly-recorded fill or cancel.** Both are permanent once recorded. Reason: deferred — see §8 open question; adding one now would be scope growth beyond the original ask.
- **No multi-user or authorization model.** There is exactly one Trader and no accounts. Reason: matches the app's existing scope; see the §1 decision override.

## 4. User stories

### US-01: Cancel a pending order

**As a** Trader
**I want** to cancel a pending order
**So that** it stops being open when I no longer intend to trade it

### US-02: Record a fill against an order

**As a** Trader
**I want** to record that an order was fully or partially executed
**So that** its remaining amount reflects reality without editing the database

### US-03: Amend a pending order

**As a** Trader
**I want** to adjust a pending order's trigger price and/or remaining amount
**So that** I can correct or adapt it without cancelling and recreating it

### US-04: View an order's fill trail

**As a** Trader
**I want** to see the individual fills recorded against an order
**So that** I can trust how its remaining amount was derived

### US-05: Be guarded against overfilling or duplicate fills

**As a** Trader
**I want** the system to reject a fill that exceeds what's left on an order, and to never let a double-submitted fill overcount
**So that** an order's remaining amount is always trustworthy, even when I make a mistake or double-click

### US-06: Keep the entry page creation-only

**As a** Trader
**I want** the order entry page to only handle creating new orders
**So that** creating and managing orders don't clutter or duplicate the same screen

### US-07: Be prevented from acting on a closed order

**As a** Trader
**I want** the system to block cancel/fill/amend on an order that's already CANCELLED or FILLED
**So that** I can't accidentally act again on an order that's no longer open

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a PENDING order with no fill events
**When** the Trader confirms cancelling it
**Then** the system marks it CANCELLED and confirms to the Trader

### AC-02 (US-01) — domain invariant

**Given** a PENDING order that already has one or more fill events
**When** the Trader attempts to cancel it
**Then** the system tells the Trader how much has already been filled and requires an explicit second confirmation naming that cancelling permanently forfeits the remaining (unfilled) amount, before proceeding

### AC-03 (US-02) — happy path

**Given** a PENDING order with a remaining amount greater than zero
**When** the Trader records a fill for an amount at or below the remaining amount
**Then** the system records a new fill event (amount + timestamp), reduces the order's remaining amount accordingly, confirms to the Trader, and — if the remaining amount reaches zero — marks the order FILLED

### AC-04 (US-05) — error

**Given** a PENDING order with a remaining amount
**When** the Trader attempts to record a fill greater than the remaining amount
**Then** the system rejects the fill and tells the Trader the amount exceeds what's left on the order, leaving the remaining amount unchanged

### AC-05 (US-05) — domain invariant

**Given** a PENDING order with a remaining amount, and two fill requests submitted for it at nearly the same time whose combined amount would exceed the remaining amount
**When** both are processed
**Then** the system accepts only as much as the remaining amount actually covers, rejects the rest as an overfill, and never lets the order's remaining amount go below zero

### AC-06 (US-03) — happy path

**Given** a PENDING order
**When** the Trader amends its trigger price and/or remaining amount to a new valid value
**Then** the system updates the order and confirms the new values to the Trader

### AC-07 (US-03) — cross-context

**Given** a PENDING order that already has one or more fill events recorded against it (a related but separately-tracked record set)
**When** the Trader amends the order
**Then** the system only ever lets the amend change the remaining (unfilled) amount — the already-filled portion, and its fill events, are never altered or reduced by an amend

### AC-08 (US-04) — happy path

**Given** an order with one or more recorded fill events
**When** the Trader opens that order's detail on the Manage Orders screen
**Then** the system shows each fill event's amount and timestamp, in order

### AC-09 (US-06) — happy path

**Given** the Manage Orders screen exists
**When** the Trader opens the order entry page
**Then** the system shows only the order creation form — no list of existing orders and no Cancel action appear there

### AC-10 (US-07) — error

**Given** an order that is CANCELLED or FILLED
**When** the Trader attempts to cancel, fill, or amend it
**Then** the system rejects the action and tells the Trader the order is no longer open

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Latency p95 cancel/fill/amend action | TBD — see §8 | TBD — see §8 |
| Throughput | TBD — see §8 | TBD — see §8 |
| Availability | TBD — see §8 | TBD — see §8 |
| Concurrency safety | two simultaneous fill requests on the same order never drive remaining amount below zero | atomic conditional update at the data layer (AC-05) |

## 6.1 Security / privacy

- **Data classification:** internal — personal trading records, not shared or published.
- **Personal data touched:** none new — this feature adds no personal-data fields beyond what order entry already stores (currency pair, amounts, prices).
- **AuthZ/AuthN impact:** none — no permission checks exist today and none are added by this feature (see the §1 decision override).
- **Abuse cases:**
  - Cross-tenant access: N/A — no tenants or accounts exist; there is exactly one Trader and one set of orders.
  - Data leak via fill/amend endpoints: N/A — no other party's data exists to leak.
  - Injection through fill/amend input fields: mitigated the same way order creation already is — numeric fields (amount, price) are validated as positive numbers; no free-text fields are added.
  - Spam-create / rate limiting: N/A — not an internet-exposed multi-user service; no rate limit need identified.
  - Token misuse: N/A — no tokens or sessions exist.
- **Security review:** N/A — internal single-user tool, no new personal data, no new authorization boundary introduced.

## 7. Metrics / KPIs

- **Manual database edits per week to correct/cancel/fill an order** — baseline: nonzero today (exact count untracked), target: 0, within 2 weeks of shipping.
- **Share of orders whose remaining amount is explainable from the UI alone** (via the visible fill trail) — baseline: 0% (no fill trail exists today), target: 100%, at ship.
- **Time to cancel/fill/amend an order via the UI** — baseline: not possible via the UI today for fill/amend (requires a DB edit), target: under 30 seconds per action, measured informally by the Trader.

## 8. Open questions

- [ ] Does the app need a correction/reversal path for a wrongly-recorded fill or cancel? Default now: no (see §3 Non-goals). — owner: Marisha, due: revisit after first real usage
- [ ] Does fill-event history need any export or aggregate view beyond the per-order expandable list? Default now: no. — owner: Marisha, due: revisit once usage shows a need
- [ ] Should a fill's timestamp be validated against the order's creation time, to prevent a causally-impossible record (e.g. a fill dated before the order existed)? — owner: Marisha, due: before `sdd:tasks` if adopted
- [ ] Could decimal rounding across multiple partial fills leave an order's remaining amount at a near-zero-but-not-exactly-zero value, preventing the PENDING→FILLED auto-transition ("phantom pending")? — owner: Marisha, due: before `sdd:data-model` — pick a rounding-safe representation
- [ ] Do latency/throughput/availability targets matter at all for this personal, single-local-user tool, or should §6 stay concurrency-only permanently? Default now: TBD, no real SLO tracked. — owner: Marisha, due: revisit if this ever runs on shared/remote infrastructure
- [ ] Should authorization/ownership ever be introduced (e.g. if this app ever becomes multi-user or gets deployed somewhere shared)? Default now: no — see the §1 decision override. — owner: Marisha, due: revisit if deployed beyond personal single-user use
