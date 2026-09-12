---
status: Living
updated_at: "2026-09-12"
---

# Domain Context — currency-exchange

## Glossary

- Amend — editing a pending order's trigger price and/or remaining amount in place. NOT cancel-and-recreate — the order keeps its identity and any existing fill history.
- Fill — a manually recorded confirmation that some or all of an order's amount was executed. NOT an automated match against a price feed — no execution engine validates it.
- Fill event — one timestamped record of a single fill against an order (amount + when). NOT the order's overall fill status — an order can have many fill events.
- Remaining amount — the order's currently unfilled amount: normally its original amount minus the sum of its fill events, but a Trader amend can set it directly, after which it is the authoritative current value even if it no longer equals original minus filled. NOT the order's original amount — that stays fixed once the order is created.
- Trader — the single person who places, cancels, fills, and amends orders in this app. NOT a role distinct from the app's owner/operator — there is exactly one, with no separate accounts.
