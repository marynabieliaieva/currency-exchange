# Data-model audit — manage-orders — 2026-09-12

## Staged migrations

**None.** This is a deliberate, confirmed outcome, not a skipped step.

- The repo has no migration tool (no Mongock/Liquibase/Flyway in `backend/pom.xml`); MongoDB is schemaless and Spring Data maps POJOs directly — no DDL is needed to add a field.
- The new fields (`Order.remainingAmount`, `Order.fillEvents`, `OrderStatus.FILLED`) are purely additive.
- AC-11 (legacy `PENDING` orders with no `remainingAmount` ever recorded) is handled by a **computed read-path fallback** in `OrderService`, per sad.md §11 — not a backfill. The user confirmed (AskUserQuestion, this session) that no backfill script should be staged either, matching the SAD's own decision.
- **Migrations are staged — not yet in the live tree** is N/A here: there is no live `migrations/` tree in this repo to promote into. `implement` has nothing to promote for this feature; it just writes the extended `Order`/`OrderStatus`/`FillEvent` code directly.

## Promote-time convention hint

N/A — no migration tool, no sequence/timestamp numbering convention exists in this repo to hint at.

## Convention deviations

None. `data-model` followed the repo's existing (implicit, by-absence) convention of no migration framework rather than introducing one. Confirmed with the user rather than assumed, since no `architecture-map.md` exists to corroborate against.

## Drift findings

Compared `data-model.md` against the current `Order.java` / `OrderStatus.java`:

| Field | In current code? | In data-model.md? | Classification |
|---|---|---|---|
| `id`, `currencyPair`, `side`, `type`, `triggerPrice`, `amount`, `status`, `createdAt` | Yes | Yes | Match — no drift |
| `remainingAmount` | No | Yes | Intentional addition (this feature), not drift |
| `fillEvents` | No | Yes | Intentional addition (this feature), not drift |
| `OrderStatus.FILLED` | No | Yes | Intentional addition (this feature), not drift |

No unintended `field-without-column` / `column-without-field` / `type-mismatch` / `nullability-mismatch` found — the only deltas are the ones this feature is designed to introduce.

## Breaking-change decompositions

None needed. `remainingAmount` is added as **nullable** specifically so no expand→backfill→contract sequence is required — existing documents simply lack the field until read (AC-11 fallback) or written (amend/fill sets it).

## Open TBDs

None left in `data-model.md`. The one blocking open question sad.md §11 flagged for this stage (rounding-safe representation for `remainingAmount`, to avoid "phantom pending") was resolved here: fixed-scale (8) `BigDecimal` on every write, making `compareTo(ZERO) == 0` exact with no epsilon heuristic.

## Self-check (4 mandatory)

- **Naming** — camelCase fields matching the repo's existing Java/Mongo convention (`triggerPrice`, `currencyPair`, etc.). Pass.
- **Down reversibility** — N/A, no migration files were staged (see above). Pass (vacuously — nothing to reverse).
- **FK indexes** — N/A, no foreign keys; `FillEvent` is embedded, not a separate collection. Pass (vacuously).
- **Convention adherence** — matches the repo's no-migration-tool, no-schema-validator convention; deviation from that would have required explicit user sign-off, which was sought (AskUserQuestion) and confirmed. Pass.

## Next stage

`api manage-orders` — the new/changed endpoints (`POST /api/orders/{id}/fill`, `PATCH /api/orders/{id}`, extended `DELETE`/`GET`) are a contract change, so `api` is not skippable here.
