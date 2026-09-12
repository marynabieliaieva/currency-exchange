# Tracker — manage-orders

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Extend Order model with FILLED status, remainingAmount, and embedded FillEvent | domain | Marisha | S | — | done |
| T2 | Add MongoTemplate-based atomic conditional update helpers | infra | Marisha | M | T1 | done |
| T3 | Implement guarded cancelOrder/fillOrder/amendOrder in OrderService | app | Marisha | L | T1, T2 | done |
| T4 | Add fill/amend endpoints, extend cancel + exception handling | ports | Marisha | M | T3 | todo |
| T5 | Add an integration-test harness (ephemeral MongoDB) | tests | Marisha | S | — | done |
| T6 | Write concurrency integration tests | tests | Marisha | M | T4, T5 | todo |
| T7 | Introduce react-router and split App.tsx into page shells | wiring | Marisha | S | — | todo |
| T8 | Extend the API client and TS types | wiring | Marisha | S | — | todo |
| T9 | Make the order entry page creation-only | ui | Marisha | S | T7 | todo |
| T10 | Build the Manage Orders list screen | ui | Marisha | M | T7, T8 | todo |
| T11 | Build the Cancel and Cancel-with-forfeiture dialogs | ui | Marisha | M | T10 | todo |
| T12 | Build the Fill entry dialog | ui | Marisha | S | T10 | todo |
| T13 | Build the Amend entry dialog | ui | Marisha | S | T10 | todo |
| T14 | Build the expandable fill trail row | ui | Marisha | S | T10 | todo |
| T15 | Add a frontend test runner and e2e-through-UI tests | tests | Marisha | L | T9, T11, T12, T13, T14 | todo |

**Total:** 15 tasks, ~1 person-week (feature size S).
