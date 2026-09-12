# Tracker — manage-orders

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Extend Order model with FILLED status, remainingAmount, and embedded FillEvent | domain | Marisha | S | — | done |
| T2 | Add MongoTemplate-based atomic conditional update helpers | infra | Marisha | M | T1 | done |
| T3 | Implement guarded cancelOrder/fillOrder/amendOrder in OrderService | app | Marisha | L | T1, T2 | done |
| T4 | Add fill/amend endpoints, extend cancel + exception handling | ports | Marisha | M | T3 | done |
| T5 | Add an integration-test harness (ephemeral MongoDB) | tests | Marisha | S | — | done |
| T6 | Write concurrency integration tests | tests | Marisha | M | T4, T5 | done |
| T7 | Introduce react-router and split App.tsx into page shells | wiring | Marisha | S | — | done |
| T8 | Extend the API client and TS types | wiring | Marisha | S | — | done |
| T9 | Make the order entry page creation-only | ui | Marisha | S | T7 | done |
| T10 | Build the Manage Orders list screen | ui | Marisha | M | T7, T8 | done |
| T11 | Build the Cancel and Cancel-with-forfeiture dialogs | ui | Marisha | M | T10 | done |
| T12 | Build the Fill entry dialog | ui | Marisha | S | T10 | done |
| T13 | Build the Amend entry dialog | ui | Marisha | S | T10 | done |
| T14 | Build the expandable fill trail row | ui | Marisha | S | T10 | done |
| T15 | Add a frontend test runner and e2e-through-UI tests | tests | Marisha | L | T9, T11, T12, T13, T14 | todo |

**Total:** 15 tasks, ~1 person-week (feature size S).
