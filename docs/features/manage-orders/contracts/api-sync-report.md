# API sync report — manage-orders

`docs/features/manage-orders/contracts/openapi.yaml` derived from `data-model.md` (Order/FillEvent
entities) + `sad.md` §6 (six sequence diagrams) + `spec.md` §4/§5 (user stories, ACs).

**Interface kind:** `sad.md` frontmatter `target_surfaces: [backend-service, web-frontend]` →
HTTP/REST (OpenAPI) for `backend-service`; `web-frontend` consumes this contract, it authors none.

**Gate:** `data-model.md` present → derived from it directly (no fast-lane skip needed).

## Deviations from skill defaults

Two of the skill's fixed defaults (`references/drift-check.md` "Defaults") are overridden here.
Per that doc these normally require an ADR; both are instead justified directly by explicit,
already-confirmed decisions in the upstream artifacts, so no new ADR was spawned for either —
recorded here loudly instead, per the skill's "never silently deviate" rule.

| Default | Override | Justification |
|---|---|---|
| `BearerAuth` global | `security: []`, no scheme defined | spec.md §1 "Decision override" + §6.1 "AuthZ/AuthN impact: none" — the app has no login/accounts/ownership model anywhere in the codebase (confirmed: no Spring Security dependency in `backend/pom.xml`), and introducing one was explicitly ruled out of scope for this feature. |
| Error envelope `{code, message, details?}` | Repo's existing `ApiError` shape (`{timestamp, status, error, messages}`), extended with an additive, nullable `code` field | The 4 existing endpoints (`POST/GET/GET/DELETE /api/orders*`) already return `ApiError` (`dto/ApiError.java`, wired via `GlobalExceptionHandler`) and this feature extends the same controller. Introducing the skill's default envelope only for the 3 new/changed endpoints would split one API into two incompatible error shapes. `code` is added because AC-04/AC-10/AC-12 each require the Trader to be told a *distinct, specific* rejection reason (`order.not_pending` / `order.fill_exceeds_remaining` / `order.invalid_fill_amount` / `order.amend_out_of_range`) that the existing `error`/`messages` free-text fields can't reliably drive UI branching on. The field is optional/nullable so the 2 pre-existing error paths (validation, not-found) keep working unchanged until migrated. |
| URL versioning `/api/v1/...` | Unversioned `/api/orders...` (matches existing) | Existing endpoints already live at `/api/orders` with no version segment; versioning only the 3 new routes would be inconsistent within one controller. No ADR — purely a consistency call with zero external consumers to break (single local Trader, no versioned clients exist). |

No Idempotency-Key requirement was added: none of the six §6 flows show a retry note or an async
actor (message bus / external system) — every mutating flow is a single synchronous atomic
conditional update against MongoDB. AC-05's double-submission guard is already covered by that
atomic update plus a client-side "disable while in flight" control (spec.md §2), not a
server-side idempotency key.

## Section A — field-origins table

| schema_path | origin | confidence |
|---|---|---|
| Order.id | existing schema — `Order.java:13` (`@Id`) | high |
| Order.currencyPair | existing schema — `Order.java:15`, pattern from `CreateOrderRequest.java:15` | high |
| Order.side | existing schema — `Order.java:16` (`OrderSide` enum) | high |
| Order.type | existing schema — `Order.java:17` (`OrderType` enum) | high |
| Order.triggerPrice | data-model.md → Order.triggerPrice (BigDecimal, scale 8, `> 0`) | high |
| Order.amount | data-model.md → Order.amount (BigDecimal, scale 8, `> 0`, immutable) | high |
| Order.remainingAmount | data-model.md → Order.remainingAmount (nullable in storage; AC-11 fallback makes it always-populated on the wire) | high |
| Order.status | data-model.md → Order.status (`PENDING`/`CANCELLED`/`FILLED`) | high |
| Order.fillEvents | data-model.md → Order.fillEvents (embedded `List<FillEvent>`, append-only, oldest-first) | high |
| Order.createdAt | existing schema — `Order.java:21` | high |
| FillEvent.amount | data-model.md → FillEvent.amount (`> 0`, `<= remaining at time of fill`) | high |
| FillEvent.timestamp | data-model.md → FillEvent.timestamp (server-set `Instant.now()`, never client-supplied) | high |
| OrderCreate.* | existing schema — `CreateOrderRequest.java` (unchanged; feature adds no fields to order creation) | high |
| FillCreate.amount | data-model.md §Entities note (line 69: "`FillRequest`... mirroring `CreateOrderRequest`'s pattern") + AC-03/AC-04 | high |
| OrderAmend.triggerPrice | data-model.md → Order.triggerPrice, amendable per AC-06 | high |
| OrderAmend.remainingAmount | data-model.md → Order.remainingAmount, amendable per AC-06, bounded per AC-07/AC-12 | high |
| Error.timestamp/status/error/messages | existing schema — `ApiError.java` (unchanged) | high |
| Error.code | inferred from AC-04/AC-10/AC-12's requirement to name a specific reason; no existing column/field (new, additive) | medium |

## Section B — drift findings (4-point checklist)

1. **Endpoint ↔ data-model** *(core)* — ✓. Every endpoint reads/writes the `Order` entity
   (`POST /api/orders` creates it, `GET` reads it, `DELETE` mutates `status`, `PATCH` mutates
   `triggerPrice`/`remainingAmount`, `POST .../fills` mutates `remainingAmount`/`status` and
   appends to `fillEvents`).
2. **Error code ↔ repo error definition** *(core)* — no central error registry exists in this repo
   (no constants/enum file, no error registry — confirmed by reading `exception/`). Recorded per
   the skill's fallback: "no error registry found — codes are the contract's proposal; reconcile
   when the repo defines them." The four new `code` values (`order.not_pending`,
   `order.fill_exceeds_remaining`, `order.invalid_fill_amount`, `order.amend_out_of_range`) are
   this contract's proposal for `implement` to introduce as real exception types, following the
   existing `OrderNotFoundException` → `GlobalExceptionHandler` pattern.
3. **Validation ↔ constraint** *(core)* — ✓. `currencyPair` pattern, positive-amount constraints,
   and enum sets all match `data-model.md` / the existing `CreateOrderRequest` bean-validation
   style. `OrderAmend.remainingAmount`'s upper bound (`amount - already-filled`) and lower bound
   (`> 0`, never exactly 0) are AC-07/AC-12 domain invariants enforced by the service's atomic
   conditional update — not expressible as a static OpenAPI bound, so the schema states
   `exclusiveMinimum: 0` only and the range rule is documented in the operation description and
   the 409 response, matching sad.md §6 Critical flow 4's re-read-to-explain pattern.
4. **OpenAPI ↔ sequence** *(supporting)* — ✓. All six flows map onto the contract:
   - Flow 1 (fill) → `POST /api/orders/{id}/fills`, its `alt`/`else` → the two 409 examples +
     the 400 validation response.
   - Flow 2 (cancel with fills) → `GET /api/orders/{id}` (forfeiture pre-check, client-side) +
     `DELETE /api/orders/{id}`.
   - Flow 3 (cancel, no fills) → `DELETE /api/orders/{id}` happy path.
   - Flow 4 (amend) → `PATCH /api/orders/{id}`, its `alt`/`else` → the 409 response.
   - Flow 5 (list + expand fill trail) → `GET /api/orders` + `GET /api/orders/{id}`.
   - Flow 6 (cross-action race on a closed order) → the shared `order.not_pending` 409, reachable
     from all three mutating operations (cancel/fill/amend) — modeled once, referenced from each.

No core point failed and no ≥3-flag threshold was hit, so this run did not pause — the three
deviations above were resolved by direct appeal to already-confirmed spec/data-model decisions
(the "Fix the source first" / "Accept as is" cases in the shared 4-state model), not left open.

## Back-feed (coverage cross-check)

- Every §5 AC maps to ≥1 operation/response: AC-01/02 → `DELETE`; AC-03/04/05 → `POST .../fills`;
  AC-06/07/12 → `PATCH`; AC-08/14 → `GET`(list)/`GET`(one); AC-10/13 → the shared `409
  order.not_pending`; AC-09/AC-15 are explicitly non-runtime (sad.md §6 closing note) — no
  operation needed, correctly excluded.
- Every operation maps to a §4 user story: `createOrder`/`listOrders`/`getOrder` → pre-existing,
  unchanged by this feature; `cancelOrder` → US-01/US-07; `recordFill` → US-02/US-05/US-07;
  `amendOrder` → US-03/US-07.
- Every sad.md §6 `alt`-branch has a response: confirmed in point 4 above. No sequence gap found —
  no OQ needed against `sequences` or `specify` for this feature.

## Definition of Done check

- [x] OpenAPI 3.1, error envelope documented (repo's existing shape + additive `code`), public
      endpoints declare `security: []` (all of them — no BearerAuth exists in this app at all).
- [x] Every operation has a request example (where applicable) + a success example + an error
      example.
- [x] All shared types via `$ref`.
- [x] `api-sync-report.md` written alongside with field-origins + 4-point checklist.
- [x] Every endpoint maps to a §4 user story; every field traces to `data-model.md` or the
      existing schema; no central error registry exists yet, so codes are recorded as this
      contract's proposal (point 2 above) rather than checked against one.
- [x] No async flows in this feature → no `events.md` needed.

## Handoff

**What I did:** Derived `contracts/openapi.yaml` (3 new operations — `PATCH /api/orders/{id}`,
`POST /api/orders/{id}/fills`, plus the existing `DELETE`/`GET` widened for the new statuses and
fill trail — alongside the unchanged `POST`/`GET /api/orders`) and this sync report, from
`data-model.md` + `sad.md` §6 + `spec.md` §4/§5. Two defaults deviated from with justification
(no auth, existing error envelope extended) rather than a new ADR, since both trace directly to
decisions already confirmed in `spec.md`.

**Review:** `docs/features/manage-orders/contracts/openapi.yaml`,
`docs/features/manage-orders/contracts/api-sync-report.md`.

**Run next:** `sad.md` `target_surfaces` includes `web-frontend`, so `screens`'s N/A condition
does not hold → `/sdd:screens manage-orders`. (No `.route` file found for this feature — behaving
as `standard`: run `/sdd:classify-size manage-orders` if you want `.size`/`.route` written
explicitly; `feature_size: "S"` in the frontmatter was used as a size signal only.)
