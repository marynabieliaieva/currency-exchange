# Test Harness & Quality Strategy

> **Note:** Lines and sections marked with are new additions to the original document. Everything else is unchanged original content.

## 1. Core Principles (Definition of Done)
- **Zero Overtesting & No Coverage Padding:** Tests must validate real business logic, boundary conditions, and failure modes. Never write tests solely to inflate code coverage metrics or mock internal implementations.
- **Test-Driven Architecture:** Code must be designed for testability out of the box (e.g., dependency injection, pure functions for domain logic, isolation of side effects). UI components must incorporate unique, stable `data-testid` attributes for Playwright compatibility.
- **Risk-Based Coverage Thresholds:** Coverage sufficiency is not judged subjectively. Critical paths (payment/currency conversion logic, FIX session state machines, MQ delivery guarantees) require exhaustive state/boundary coverage (target: 100% of defined state transitions and boundary classes). Non-critical paths follow standard EP/BVA coverage without a fixed percentage target.
- **Test Effectiveness Must Be Measurable, Not Assumed:** It is not enough to claim tests validate "real business logic" — this must be verifiable (see Mutation Testing, Section 6).

---

## 2. Test Pyramid & Responsibilities

### 2.1 Backend Unit Tests

| Category | Details |
| :--- | :--- |
| **What to test** | Business logic in isolation (service methods, domain rules, calculations, validations); edge cases and boundary values (null, empty collections, limits); logic branches (if/switch, error-handling paths); mappers/data transformations (DTO ↔ Entity); pure functions and algorithms; contracts via mocked dependencies (repositories, external clients — mocked) |
| **What NOT to test** | Real DB, network, or filesystem calls — that's integration-level; framework code (DI container internals, ORM mapping); public API end-to-end (routing, HTTP serialization) — integration/API-level; interaction between multiple services; performance and concurrency |
| **Methodology / Design** | Runs without spinning up containers, DB, or network. Executes in milliseconds. Tests a single class/method in isolation using mocks |

### 2.2 UI Unit Tests

| Category | Details |
| :--- | :--- |
| **What to test** | Rendering a component with different props/states (conditional rendering, disabled/loading/error states); local component logic (event handlers, computed values, formatting, client-side form validation); reaction to user input (click, typing → correct callback/state change); snapshots for stable presentational components (used sparingly, not overused); hooks/composables in isolation |
| **What NOT to test** | Real API calls (network/services must be mocked); pixel-perfect visual layout (that's visual regression — a separate tool); full user journeys across multiple screens/routes (that's E2E — Playwright/Selenium); interaction between several components through a real DOM tree (component integration — different tier); CSS/styling as such |
| **Methodology / Design** | Renders a single component in isolation (shallow/mount, without a real router, store, or network). Fast. Not brittle to internal refactoring — verifies behavior, not DOM details |

### 2.3 Component (FE) Tests

| Category | Details |
| :--- | :--- |
| **What to test** | A component (or small tree of tightly-coupled components) with its real internal wiring — child components, local state management, context providers, conditional rendering paths driven by state changes; user interaction flows within the component boundary (multi-step forms, modals, dropdowns, accordions); loading/error/empty states as they actually transition (not just static snapshots); accessibility roles and keyboard navigation within the component |
| **What NOT to test** | Global app routing or navigation between pages; real backend/API calls (network is mocked at the boundary, e.g. MSW); full end-to-end user journeys spanning multiple screens; visual pixel-level regression (separate tooling); business logic that belongs to a single pure function/hook already covered at unit level (don't re-test the same branch here) |
| **Methodology / Design** | State Transition Testing (verify state changes drive the correct rendered output); Props Variation Testing (systematically vary prop combinations, including edge/optional props); mount with a lightweight test harness (e.g. Testing Library) rather than full app shell; network mocked at the service boundary, not skipped entirely |

### 2.4 Component (BE) Tests

| Category | Details |
| :--- | :--- |
| **What to test** | A single subsystem module's internal logic in isolation, with all external dependencies mocked (e.g. an order-processing service's business rules spanning several internal classes); GraphQL schema resolvers/validation for that service; repository query/mapping logic (e.g. MongoDB) against a **mocked** driver or in-memory fake, not a real database; message-handler logic (parsing, routing, ack/nack behavior) against a **mocked** broker; protocol parser/state logic (e.g. FIX) against a **mocked** session |
| **What NOT to test** | Any flow that spans more than one service/module — that belongs to the Integration tier; real, live connections to MongoDB/MQ/FIX — even the same logic above, but exercised against a real containerized instance — that's Integration tier; anything UI-related (not applicable to BE) |
| **Methodology / Design** | State & Protocol Transition Testing (verify correct state/ack/nack transitions for valid and invalid inputs); Payload Boundary Analysis (malformed, oversized, missing-field payloads); dependencies replaced with mocks/fakes, never a real containerized instance |


### 2.6 Integration (Full / System) Tests

| Category | Details |
| :--- | :--- |
| **What to test** | End-to-end API contracts between services; multi-service workflows (a request that traverses two or more subsystems); DB migrations and schema changes against a real database; full transport pipelines (e.g. a message produced on MQ and consumed downstream, a FIX message round-trip); tests against real containerized dependencies (MongoDB, MQ brokers, FIX simulators) rather than mocks; consumer-driven contract validation between services |
| **What NOT to test** | Internal helper/pure-function logic already covered at Unit level; single-module business rules already covered at Component level; redundant micro-edge-cases (null checks, boundary values) that unit/component tests already exercise — re-verify the *integration seam*, not the logic behind it |
| **Methodology / Design** | Pairwise Testing (combine filters, multi-protocol states, user roles to cover interaction combinations efficiently); Consumer-Driven Contract Testing (e.g. Pact) for cross-service API contracts; run against real containerized instances for our own existing in fxone domain services and dependencies (MongoDB, MQ brokers, FIX simulators); external/third-party services are mocked or stubbed at the boundary, since we don't control their uptime, data, or rate limits. **Coverage-reuse rule:** if a given case/queue/message path is already exercised by an existing integration test, do not write a new test to cover the same path again just because it appears under a different business case — extend or parametrize the existing test instead of duplicating it |

---

## 3. Mandatory Test Design Rules
1. **Equivalence Partitioning (EP):** Divide input domains into valid and invalid classes. Test at least one representative value from each partition.
2. **Boundary Value Analysis (BVA):** For numerical or length-based inputs, always test: `min`, `min-1`, `min+1`, `max`, `max-1`, `max+1`, `null/undefined`.
   - **Monetary/Decimal-Specific BVA:** For all currency and monetary values, additionally test: smallest currency unit (e.g., 0.01), rounding-boundary values (e.g., 0.005 rounding behavior), values exceeding safe decimal precision, negative amounts where illegal, and cross-currency conversion rounding drift over repeated operations.
3. **Pairwise Combinations:** For features with multiple filtering or permission parameters, use combinatorial reduction (Pairwise) to test critical multi-variable paths without combinatorial explosion.
4. **State Transition Testing:** For components, UI flows, and session/protocol handlers (e.g., FIX/MQ states), map out all valid/invalid state transitions and illegal action attempts.
5. **Decision Table Testing:** For complex business rules, pricing, permissions, and filters, use decision matrices to cover all logical condition combinations.
6. **Error Guessing & Negative Testing:** Proactively target edge failures, malformed payloads, network drops, and schema violations.
7. **Flaky Test Policy:** Any test that fails intermittently without a code change must be quarantined immediately (tagged `@flaky`, excluded from the blocking pipeline) and tracked with an owner and a fix deadline (e.g., 5 business days). Flaky tests must never be deleted silently or left in the blocking suite "just in case" — this erodes trust in the whole suite over time.
8. **Contract Testing:** All cross-service API contracts (especially between BE services and FE, and between internal microservices) must be validated via consumer-driven contract tests, not solely through end-to-end integration tests, to catch breaking changes early and cheaply.

---

## 4. Subagent Delegation & Review Protocol
Trigger specialized subagents based on the implementation layer and review phase:

- **`@test-strategist`**: Invoke first for *any* feature change. Analyzes the requirements, selects appropriate test design techniques (EP, BVA, Pairwise, State Transition, Decision Tables), and maps out the complete test matrix across all tiers. Must also classify the feature's paths as *critical* or *standard* per the risk-based coverage rule in Section 1.
- **`@frontend-tester`**: Handles FE unit tests (hooks, utils, domain logic), isolated UI component tests (with state/props variations), and enforces the mandatory implementation of unique, stable `data-testid` attributes for Playwright compatibility. Also runs automated a11y audits on new/changed components.
- **`@backend-tester`**: Handles BE isolated unit tests for domain logic, as well as BE component-level tests for subsystem modules, GraphQL schemas, MongoDB repositories, MQ message handlers, and FIX protocol parsers (mocked dependencies only per Section 2).
- **`@integration-tester`**: Handles full system and integration tiers, including multi-service workflows, end-to-end API contracts, database migrations, and transport pipelines against real containerized dependencies. Owns consumer-driven contract test suites.
- **`@test-reviewer`**: **Mandatory final quality gate.** Reviews all generated tests across all tiers before merging. Rejects tests that are written solely for coverage padding, target internal implementation details instead of behavior, or suffer from weak assertions/over-mocking. Must validate against the mutation-testing score (Section 6) rather than relying solely on subjective judgment of assertion quality. Escalation: if `@test-reviewer` and the implementing agent/developer disagree on a rejection, the case is escalated to `@test-strategist` for a binding ruling, with the rationale logged in the PR.

---

## 5. Execution & Validation
- **Automated Test Run:** Trigger local test suites using permitted scripts (unit, component, and integration/containerized pipelines) to verify execution before finalizing the implementation.
- **Strict Quality Gate:** The `@test-reviewer` must validate that all tests pass, avoid mock-heavy anti-patterns, ensure real integration paths are tested (especially for MongoDB, MQ, and FIX protocols), and verify that frontend components utilize proper `data-testid` attributes.
- **Flaky Test Gate:** No newly introduced test may be merged in a flaky state; any pre-existing flaky test touched by a change must be stabilized or explicitly quarantined as part of the same PR.

---

## 6. Test Effectiveness Validation
- **Mutation Testing:** Run mutation testing (e.g., Stryker for JS/TS) on critical business logic (currency conversion, pricing, FIX/MQ handlers) at least on every release branch. A mutation score below an agreed threshold (e.g., 80%) blocks merge for that module, providing an objective, measurable answer to "do these tests actually validate business logic" rather than relying on reviewer intuition.
- **Coverage Reporting Discipline:** Code coverage percentage is tracked for visibility only and is explicitly **not** a merge gate on its own — mutation score and risk-based tier coverage (Section 1) are the actual gates, to prevent coverage-padding incentives from creeping back in.

## 7. Constraints

- **No production code changes for the sake of testing.** Test implementation agents (`@frontend-tester`, `@backend-tester`, `@integration-tester`) may create, modify, or delete files under test directories only. They must never modify application/production source files (components, services, business logic, schemas, configs) to make a scenario testable, easier to test, or to add test-only hooks (e.g. `data-testid`, exported internals, test-only flags/branches).
- **Testability issues are escalated, not silently fixed.** If a scenario cannot be implemented without a change to production code (missing selector, untestable coupling, no dependency-injection seam, etc.), the responsible agent must NOT make the change itself. It must flag the specific file/line and the blocking reason back to the Test Strategist / user for a decision, and skip that scenario in the current iteration (mark it as blocked in `active-plan.md`, not as done or silently reassigned).
- **Explicit exception process only.** Any production-code change proposed to improve testability (e.g. adding a `data-testid`, extracting a pure function, adding a DI seam) requires explicit user approval before implementation — it is never bundled silently into a test-only commit or reported only as part of a general test summary.
- **Rationale:** keeps test suites decoupled from source changes, keeps code review of behavior changes separate from test changes, and prevents test agents from quietly altering application behavior/markup as a side effect of chasing coverage.