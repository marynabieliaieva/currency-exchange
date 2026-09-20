---
status: draft            # draft | approved
feature_size: "S"
tool: "code"
updated_at: "2026-09-12"
---

# Screens — manage-orders

> The canonical **screen manifest** — every screen in every state — produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest** — never the raw Figma / `.pen` file.

## Source

- **Tool:** code — **degraded from the plugin default.** `docs/design-system.md` does not exist
  yet in this repo (confirmed missing at generation time), so there is no recorded `tool` to
  inherit and no formal component inventory to read from. This manifest instead reuses the
  informal patterns already present in `frontend/src/components/OrderEntryForm.tsx`,
  `OrderList.tsx`, and `App.tsx` (labeled inputs, the `.form-error` text pattern, the disabled-row
  table pattern, the "No orders yet." empty-list text) and marks everything with no existing
  counterpart as `NEW:`. Run `/sdd:design-system` to make `code` (or another tool) the recorded
  project-wide choice and register the `NEW:` components below into its inventory.
- **File:** inline wireframes below.

## Screens

### SCR-01 — Order entry page

Creation-only (AC-09) — the inline order list and Cancel button that used to live here are
removed entirely.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Screen opened; form empty/reset | LabeledInput, Select, SubmitButton | wireframe below |
| loading | Create request in flight | SubmitButton (disabled, "Submitting…") | wireframe below |
| validation-error | Bad currency-pair pattern, or price/amount ≤ 0 — client check mirrors `OrderEntryForm`'s existing `validate()`, or a 400 from `POST /api/orders` | InlineErrorText (`.form-error` pattern) | wireframe below |
| success | Order created — AC-09 removed the list that used to make this visible implicitly, so an explicit confirmation is now required | NEW: InlineStatusBanner (success variant) | wireframe below |
| empty | N/A: creation-only screen has no list to be empty (AC-09) | — | — |

```text
+--------------------------------------+
| Currency Exchange — Order Entry      |
| [ nav: New Order | Manage Orders ]   |
+--------------------------------------+
| New Order                            |
|  Currency Pair [ EUR/USD        ]    |
|  Side          [ Buy        v ]      |
|  Order Type    [ Take Profit v ]     |
|  Trigger Price [               ]     |
|  Amount        [               ]     |
|                                       |
|  (validation-error) "Amount must..." |
|  (success) "Order created."          |
|                                       |
|  [ Submit Order / Submitting... ]    |
+--------------------------------------+
```

### SCR-02 — Manage Orders screen

Lists every order regardless of status; Cancel/Fill/Amend enabled only on PENDING rows (AC-14).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| loading | `GET /api/orders` in flight | NEW: LoadingIndicator (plain text, no primitive exists) | wireframe below |
| empty | List returns `[]` — reuses `OrderList.tsx`'s existing "No orders yet." text | EmptyStateText (existing) | wireframe below |
| default | Populated table; PENDING rows' Cancel/Fill/Amend enabled, CANCELLED/FILLED rows' disabled (AC-14) | OrderTable, RowActionButton (existing disabled-button pattern) | wireframe below |
| row-action-in-flight | A row's own Cancel/Fill/Amend request is in flight — that row's buttons disabled (double-submit guard, sad.md §8) | RowActionButton (disabled variant) | wireframe below |
| error | `GET /api/orders` fails — reuses `App.tsx`'s existing `loadError` pattern | InlineErrorText (existing) | wireframe below |
| action-rejected | A row's action loses the AC-10/AC-13 race (order closed moments earlier by a different action) | NEW: InlineStatusBanner (error variant, row-scoped) | wireframe below |

```text
+-----------------------------------------------------------------+
| Currency Exchange — Manage Orders                               |
| [ nav: New Order | Manage Orders ]                               |
+-----------------------------------------------------------------+
| (loading) "Loading orders..."                                    |
| (empty)   "No orders yet."                                       |
| (error)   "Failed to load orders"                                |
+-----------------------------------------------------------------+
| Pair    | Side | Type | Price | Amount | Remain | Status | Act. |
|---------|------|------|-------|--------|--------|--------|------|
| EUR/USD | BUY  | TP   | 1.085 | 1000   | 400    | PENDING| [Cancel][Fill][Amend] |
| >  (expand: fill trail, SCR-07)                                  |
| GBP/USD | SELL | SL   | 1.250 | 500    | 500    | CANCELLED | (disabled) |
|                                                                   |
| (row-action-in-flight) buttons show disabled while in flight     |
| (action-rejected) "order is no longer open" banner on that row   |
+-----------------------------------------------------------------+
```

### SCR-03 — Cancel confirmation dialog

For a PENDING order with **no** fill events (AC-01).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Cancel clicked on a fill-free PENDING row | NEW: Modal, NEW: ConfirmDialogBody | wireframe below |
| loading | Confirm submitted, `DELETE` in flight — buttons disabled | Modal, ConfirmDialogBody (loading) | wireframe below |
| error | Rejected inline — order vanished (404) or no longer PENDING (409 `order.not_pending`, AC-10 race) | NEW: InlineStatusBanner (error, in-dialog) | wireframe below |
| empty | N/A: not a list | — | — |

```text
      +---------------------------------+
      | Cancel this order?              |
      | EUR/USD BUY 1000 @ 1.085         |
      |                                  |
      | (error) "order is no longer open"|
      |                                  |
      |         [ Dismiss ] [ Confirm ] |
      +---------------------------------+
```

### SCR-04 — Cancel-with-forfeiture confirmation dialog

For a PENDING order that **already has fills** (AC-02).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| loading | Cancel clicked; fetching the order's fill total before the dialog can state the forfeited amount | Modal (loading body) | wireframe below |
| default | Dialog states the amount already filled and the amount that will be forfeited; requires an explicit second confirmation | NEW: ForfeitureConfirmDialogBody | wireframe below |
| confirming | Second confirmation submitted, `DELETE` in flight — buttons disabled | ForfeitureConfirmDialogBody (loading) | wireframe below |
| error | Rejected inline — order vanished (404) or no longer PENDING (409 `order.not_pending`, AC-10 race) | InlineStatusBanner (error, in-dialog) | wireframe below |
| empty | N/A: not a list | — | — |

```text
      +---------------------------------------+
      | Cancel this order?                    |
      | EUR/USD BUY 1000 @ 1.085               |
      | Already filled: 600. Cancelling        |
      | permanently forfeits the remaining 400.|
      |                                        |
      | (error) "order is no longer open"      |
      |                                        |
      |     [ Dismiss ] [ Confirm forfeiture ] |
      +---------------------------------------+
```

### SCR-05 — Fill entry dialog

Record a fill against a PENDING order (AC-03, AC-04, AC-05).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Fill clicked on a PENDING row; remaining amount shown (AC-11 fallback already applied server-side) | NEW: FillDialogForm | wireframe below |
| loading | Fill submitted, `POST /fills` in flight — input+button disabled (US-05 double-submit guard) | FillDialogForm (loading) | wireframe below |
| error | Rejected inline, one banner covering 3 reasons: non-positive amount (400 `order.invalid_fill_amount`, AC-04), amount exceeds remaining (409 `order.fill_exceeds_remaining`, AC-04), order no longer PENDING (409 `order.not_pending`, AC-10 race) | InlineStatusBanner (error, in-dialog) | wireframe below |
| success | Fill recorded (AC-03) — dialog closes; confirmation and any FILLED transition shown on the SCR-02 row, not inside this dialog | — (transient, closes) | wireframe below |
| empty | N/A: not a list | — | — |

```text
      +---------------------------------+
      | Record a fill                   |
      | EUR/USD BUY — remaining: 400     |
      |                                  |
      | Amount [            ]           |
      |                                  |
      | (error) "amount exceeds what's  |
      |          left on the order"     |
      |                                  |
      |         [ Cancel ] [ Record ]   |
      +---------------------------------+
```

### SCR-06 — Amend entry dialog

Adjust a PENDING order's trigger price and/or remaining amount (AC-06, AC-07, AC-12).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Amend clicked; fields pre-filled with the order's current triggerPrice/remainingAmount | NEW: AmendDialogForm | wireframe below |
| loading | Amend submitted, `PATCH` in flight — inputs+button disabled | AmendDialogForm (loading) | wireframe below |
| error | Rejected inline, one banner covering 3 reasons: outside the allowed range (409 `order.amend_out_of_range`, AC-12), order no longer PENDING (409 `order.not_pending`, AC-10 race), bad format (400 bean validation) | InlineStatusBanner (error, in-dialog) | wireframe below |
| success | Amend applied (AC-06) — dialog closes; new values confirmed on the SCR-02 row | — (transient, closes) | wireframe below |
| empty | N/A: not a list | — | — |

```text
      +---------------------------------+
      | Amend order                     |
      | EUR/USD BUY — filled so far: 600 |
      |                                  |
      | Trigger Price     [ 1.0850 ]    |
      | Remaining Amount  [  400   ]    |
      |                                  |
      | (error) "remainingAmount must   |
      |  be > 0 and at most 400"        |
      |                                  |
      |         [ Cancel ] [ Amend ]    |
      +---------------------------------+
```

### SCR-07 — Expanded fill trail

Each fill event's amount and timestamp, oldest first (AC-08).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Row expanded on an order with ≥ 1 recorded fill event | NEW: FillTrailPanel (reuses OrderTable row styling) | wireframe below |
| empty | N/A: the expand control only appears on rows that already have ≥ 1 fill event (AC-08's own precondition) — there is nothing to expand into on a zero-fill row | — | — |
| loading | N/A: `fillEvents` ships embedded in the same `Order` object already fetched for SCR-02's list — expand is a pure client-side toggle, no separate request | — | — |
| error | N/A: same reason — no separate fetch to fail | — | — |

```text
| EUR/USD | BUY | ... | PENDING | [Cancel][Fill][Amend] |
| v  Fill trail:                                         |
|     200.00  @ 2026-09-10 09:12:03                       |
|     400.00  @ 2026-09-11 14:03:47                       |
```

## New components

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| Modal | No dialog/overlay primitive exists anywhere in the current inventory; SCR-03/04/05/06 all need one | pending |
| ConfirmDialogBody | No confirmation-dialog content pattern exists today | pending |
| ForfeitureConfirmDialogBody | Extends ConfirmDialogBody with the forfeited-amount statement AC-02 requires — no equivalent exists | pending |
| FillDialogForm | No fill-entry form exists yet | pending |
| AmendDialogForm | No amend form exists yet (dual optional fields, pre-filled from current values) | pending |
| FillTrailPanel | No expand/collapse primitive exists on the current table row pattern | pending |
| InlineStatusBanner | The existing `.form-error` text only covers errors; AC-01/AC-02/AC-03/AC-06 all require an explicit success confirmation the app has no UI for today | pending |
| LoadingIndicator | No loading/skeleton primitive exists; SCR-02's initial fetch needs one | pending |
