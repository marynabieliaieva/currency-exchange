---
id: T5
title: "Add an integration-test harness (ephemeral MongoDB) for the backend"
layer: "tests"
deps: []
blocks: ["T6"]
acs: []
files_hint: ["backend/pom.xml", "backend/src/test/java/com/currencyexchange/orderentry/IntegrationTestSupport.java"]
owner: "Marisha"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T5 — Add an integration-test harness (ephemeral MongoDB) for the backend

## Place in the sequence

- **Blocked by:** none — pure tooling setup, independent of the model/service work. **Blocks:** T6 — Concurrency integration tests (needs a real MongoDB to observe actual write serialization, which a mocked repository cannot demonstrate). **Wave:** 1 (can start immediately, in parallel with T1–T4 and T7–T14).
- **Lane:** own lane — no `files_hint` overlap with any other task.

## Why (user story)

This task has no directly corresponding user story — it is infrastructure setup identified as a repo gap, required before T6's concurrency tests (which verify US-05 / AC-05 / AC-13) can exist at all.

> This feature is the first to need real test infrastructure: the repo has one mocked-repository unit test class (`OrderServiceTest`) and no integration-test harness, and the frontend has no test runner at all.
>
> — `sad.md §11, Risks and technical debt row 5, verbatim` · full text: [sad.md](../sad.md)

## Inlined context

> Add an integration-test setup (e.g. an embedded/ephemeral MongoDB) for the concurrency scenarios in §10 QG-1 ... before those §10 verifications can run — scope this as setup work in `tasks`, not assumed-available tooling.
>
> — `sad.md §11, Risks and technical debt row 5 (Mitigation column), verbatim` · full text: [sad.md](../sad.md)

> **How verify (QG-1):** an integration test that fires two concurrent requests (two fills, and a fill racing a cancel) against the same order and asserts exactly one succeeds and the remaining amount is never negative.
>
> — `sad.md §10, QG-1 Concurrency safety, verbatim` · full text: [sad.md](../sad.md)

> MongoDB (project runs 6.0.27 for local Windows compatibility; standalone single-node — no replica set, no multi-document transactions available).
>
> — `sad.md §2, Constraints — Technical, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

No spec §5 AC maps directly to this task — it is the test-infrastructure prerequisite T6 needs to verify AC-05/AC-13 for real.

## Checklist

- [ ] Add an ephemeral-MongoDB test dependency to `backend/pom.xml` (e.g. Flapdoodle embedded Mongo, matching the project's MongoDB 6.0.27 — see [[mongodb_windows_compat]]) scoped to `test`
- [ ] Add `IntegrationTestSupport` (a base test class or `@TestConfiguration`) that boots the ephemeral instance and points `spring.data.mongodb.uri` at it for the test context — `backend/src/test/java/com/currencyexchange/orderentry/IntegrationTestSupport.java`
- [ ] Write one trivial integration test proving the harness works: save an `Order` via the real `OrderRepository`, read it back, assert equality
- [ ] Confirm `mvn test` runs the new integration test without requiring a locally-running MongoDB instance

## Edge cases

| Case | Behaviour |
|---|---|
| CI/dev machine has no MongoDB installed at all | Ephemeral instance is self-contained (downloads/runs its own binary) — no external MongoDB dependency for `mvn test` |
| Windows-specific MongoDB compatibility issue (this project already pins 6.0.27 locally for this reason) | Pick an ephemeral-Mongo tool/version compatible with Windows and close to 6.0.27; note any deviation in the PR description |

## Definition of Done

- [ ] the trivial harness-proof integration test passes in `mvn test`
- [ ] no locally-installed MongoDB is required to run the backend test suite
- [ ] lint + vet clean
