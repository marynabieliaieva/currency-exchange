# Declined Test Patterns

(No patterns recorded yet — no proposed scenario has been declined by the user.)

---

# Architectural Constraints & Corrected Judgments

Durable facts a future strategist run must not re-litigate. Not a chronological log — update entries
in place and increment the occurrence counter when a pattern recurs.

## backend / OrderService + OrderMongoOperations

**Never call a defensive guard "dead code" from the call graph alone when a value transformation sits
between the guard and its consumer.** (occurrences: 1 — 2026-09-13, manage-orders)
I judged `OrderMongoOperations.tryAmend`'s `newRemaining <= 0` branch unreachable because
`OrderService.amendOrder` checks positivity first. Wrong: that check runs on the **raw** argument and
`normalize()` (scale 8, `HALF_UP`) runs *after* it, so a sub-scale positive input such as
`0.000000001` passes every upstream check and arrives at the repository as exactly `0.00000000`.
The branch is the only thing preventing a `PENDING` order being written with `remainingAmount = 0`
and no `FILLED` transition. Rule: trace value transformations, not just control flow, before
proposing deletion — and prefer a pinning regression test over removal when in doubt.

**Positivity-vs-normalization ordering is not uniform in this module.** (occurrences: 2 — re-verified
2026-09-13, strategist pass 3) Three amount-bearing entry points, three different orderings:

| Method | Ordering | Verdict | Symptom of a sub-scale positive input (e.g. `0.000000001`) |
|---|---|---|---|
| `fillOrder` | normalize → check | correct | 400 `order.invalid_fill_amount` |
| `amendOrder` | check → normalize | defect | 409 `order.amend_out_of_range`, misleading ceiling message |
| `createOrder` | normalize, **never checks** | worse defect | a `PENDING` order with `amount = remainingAmount = 0` — unfillable and unable to ever reach `FILLED` |

`createOrder` was missed in the pass-2 sweep because the audit stopped at the two methods that have
an explicit positivity branch. Rule: enumerate amount-bearing operations by *whether a value reaches
`normalize()`*, not by whether a positivity check is visible. `CreateOrderRequest.amount` carries
`@DecimalMin(0.0, exclusive)`, which passes any sub-scale positive, so bean validation is not the
backstop it looks like. Any new amount-bearing operation must be added to this table.

**`FillRequest` intentionally carries only `@NotNull`, never `@DecimalMin`.** (settled 2026-09-13)
Bean validation would intercept before `OrderService` runs, and `GlobalExceptionHandler.handleValidation`
never sets `ApiError.code`, so the documented `order.invalid_fill_amount` would silently disappear;
and only a post-normalization check catches a sub-scale positive amount at all. `openapi.yaml` was
corrected to describe the service-raised 400. **Do not re-flag this as contract drift.**

**`OrderMongoOperations` has no BE-component tier, deliberately.** The logic under test *is* MongoDB
query language (`$expr`/`$toDecimal` guards, `$reduce` over `fillEvents`, update-with-aggregation
pipeline). Mocking the driver would assert we built the `Document` we built — a tautology with zero
mutation value, i.e. exactly the coverage padding rules §1 forbids. It is covered at Integration tier
only, and `@integration-tester` owns `OrderMongoOperationsIntegrationTest` despite its `repository/`
location and `...IntegrationTest` name.

## frontend

**Selector policy (set 2026-09-13, after `data-testid` was approved and added to all 7 components).**
Component tests keep **role/label** selectors — they assert accessible semantics that `data-testid`
cannot. E2E/Playwright uses `data-testid` for refactor stability. Do **not** propose migrating passing
component tests to testids; it is churn with no coverage gain.

**Frontend money is IEEE-754, backend money is scale-8 `BigDecimal`.** Any FE scenario that sums or
displays amounts (forfeiture totals, "filled so far") must treat drift as expected behaviour to be
characterized, not as a backend bug.
