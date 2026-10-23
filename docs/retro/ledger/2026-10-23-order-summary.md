# Retro: order-summary   |   2026-10-23   |   Workflow: /sdd-engineering:run-plan (no --review)

Inputs: plan `docs/plans/order-summary.md`, spec `specs/2026-10-23-order-summary/spec.md` (from the plan's Context), no flags, no extra requirements, no designs   ·   Data source: in-context only

## 1. Run facts

- Wall time: start and end were not recorded in-context. Subagent durations add up to 117.0 s (65.0 + 36.6 + 15.4), all run one after another. The final `npm test` took 15.03 s and started at 18:16:00 (source: vitest output). Orchestrator time is not measured.
- Agents: 3 (peak parallel 1). By type: implementer × 1, plan-verifier × 1, architecture-reviewer × 1
- Tokens: subagents 109,785 (source: in-context `<usage>`). Main session: not measured, use `--deep`. The fresh-input/output vs cache-read split is not available in-context.
- Top 3 agents by tokens:
  1. implementer T1, 43,238. It wrote 2 files and ran 7 tools.
  2. plan-verifier, 34,268. It read both files and recomputed the fingerprint.
  3. architecture-reviewer, 32,279. It ran 3 tools on a diff with a single import line.
- Loops: verification 0/2, architecture 0/3 (clean in round 1), final run 0/2, review not run (no `--review`). Caps hit: none
- Human interventions: 0. No questions were asked during the run and the user made no corrections.

### Timeline

| # | Wave / phase | Agent (type) | Task / purpose | Outcome | Tokens | Duration |
|---|---|---|---|---|---|---|
| 1 | Wave 1 (serial: single-agent mode, one task) | sdd-engineering:implementer | T1 `summarizeOrders` + tests | green, 0 fix cycles, 23/23 tests | 43,238 | 65.0 s |
| 2 | Step 2 verification | sdd-engineering:plan-verifier | T1 ACs | 14 MET / 0 PARTIAL / 0 NOT MET / 0 CANNOT VERIFY | 34,268 | 36.6 s |
| 3 | Step 3 architecture review | architecture-review:architecture-reviewer | diff vs main + untracked files | ARCHITECTURE_CLEAN | 32,279 | 15.4 s |
| 4 | Step 4 final run | orchestrator (Bash) | tsc, npm test, import grep, git status | all pass: 4 files / 42 tests | n/a | ~15 s (test run) |

Step 3b was skipped because there were no review fixes. Step 5 was skipped because `--review` was not passed.

## 2. Quality metrics

- First-pass yield: 100% (1/1)
- Rework ratio: 0 (no fix tasks)
- Evidence reuse: 2 accepted by fingerprint (tsc, vitest) / 0 test re-runs. The verifier's first fingerprint recompute was run from `frontend/` and failed to open the test file. Its second, run from the repo root with repo-relative paths, matched.
- Environment vs product: 0 env issues vs 0 product defects

### Defect escape matrix

| Defect | Introduced in | Should have been caught by | Caught by | Why it slipped |
|---|---|---|---|---|
| none | | | | |

## 3. Insights per agent type

### sdd-engineering:implementer
- Hard: nothing. "Fix cycles used: 0".
- Easy: the plan's Key constraints were detailed enough to implement directly: exact signature, the only allowed import, the `byStatus` init, rounding, and the `__proto__` strategy. Its report says "Deviations from plan: None. I used the plan's recommended approaches". 7 tool calls in total.
- Duplicated: `npx tsc -b` ran in the task and again in the final run. That repeat is by design.
- Missed: skills were marked "digest, via Key constraints". The implementer relied on the plan's restatement and did not show that it loaded the digests. The verifier marked this "claimed, not verifiable".

### sdd-engineering:plan-verifier
- Hard: it recomputed the fingerprint from `frontend/` first, and that failed ("From `frontend/` the command failed to open the test file"). The implementer reported its commands as run from `frontend/` but gave no working directory for the fingerprint.
- Easy: it accepted test results by fingerprint, so there was no test re-run.
- Duplicated: it read both new files in full. The architecture-reviewer read them too. This is cheap at this size.
- Missed: the summary line said "12 MET" for 14 AC bullets, and the report corrected it further down ("The correct roll-up is 14 MET"). The roll-up groups rows differently from the plan's bullets.

### architecture-review:architecture-reviewer
- Hard: nothing.
- Easy: 3 tool calls, verdict clean.
- Duplicated: see plan-verifier.
- Missed or limited:
  - It applied only P/X/D rules. Its report says "A, B1 and F sets are not applied because the project declares no onion or feature-based frontend rules", although the plan's constraints came from the `frontend-ui-architecture` digest.
  - Its P-rules came from `CLAUDE.md`, which is stale. That file lists the frontend layout as `types/ api/ components/ App.tsx`, but the code has `pages/` and routing (`App.test.tsx` "App routing", `ManageOrdersPage.test.tsx`). It also says orders only go "PENDING → CANCELLED; there is no filled state", but the code and tests have FILLED, Fill and Amend.
  - The diff vs main included `.claude/settings.json` from the earlier chore commit on the same branch (`chore/install-sdd-engineering`), which added noise to the review.

## 4. Module insights

- frontend:
  - `tsconfig.json` includes `src`, so test files are type-checked by `tsc -b` too. With `noUnusedParameters` on, unused parameters in tests must be `_`-prefixed.
  - Untrusted string keys (`currencyPair`, including `"__proto__"`) are built safely by accumulating in a `Map` and copying the entries with `Object.defineProperty` into a plain `{}`.
  - Monetary sums use one precision-collapsing rounding per pair total.
  - `ManageOrdersPage.test.tsx` dominates suite time (13 tests, 6.7 s of the 15 s run).
- backend: not touched.
- tooling:
  - The change fingerprint only reproduces from the repo root with repo-relative paths.
  - `tsc -b` may rewrite `frontend/tsconfig.tsbuildinfo`, but it did not show up in this run.

Suggested engineering-insights entries:
- frontend: `__proto__`-safe record building (Map + `Object.defineProperty`) for untrusted keys.
- frontend: test files are type-checked by `tsc -b`, so `_`-prefix unused parameters.

## 5. Proposals

| # | Target (file) | Change | Evidence | Expected effect | Effort | Status |
|---|---|---|---|---|---|---|
| 1 | `CLAUDE.md` | Update the order lifecycle (FILLED status, fill/amend actions) and the frontend layout (`pages/`, routing) to match the code | Arch-reviewer built its P-rules from "types/ api/ components/ App.tsx". The suite shows FILLED, Fill and Amend and "App routing" tests | Next arch review's P-rules list `pages/` and FILLED | S | proposed |
| 2 | `CLAUDE.md` | State that `frontend/` follows `frontend-ui-architecture` (and onion for `backend/`, if intended) | Reviewer: "A, B1 and F sets are not applied because the project declares no … rules". The plan used that digest | Next review reports the F set (and A, if declared) as applied | S | proposed |
| 3 | `.claude/rules/test-strategy.md` | Add a short section mapping §4 agents (`@test-strategist`, `@test-reviewer`) onto the sdd-engineering run-plan steps, or state that plan-verifier fills that role | Plan Open question: "whether `@test-reviewer` should also review `orderSummary.test.ts`". run-plan never dispatches it | The next plan has no open question about `@test-reviewer` | S | proposed |
| 4 | Process / branch (no file; optionally a note in `CLAUDE.md`) | Run feature plans on a branch cut from `main`, not on a chore branch | The diff vs main included `.claude/settings.json` from the chore commit | The arch-review diff lists only feature files | S | proposed |
| 5 | Plugin: `sdd-engineering/agents/implementer.md` + `plan-verifier.md` (marketplace repo) | Make the fingerprint recipe state the cwd (repo root) and path form (repo-relative) in the Execution Report | Verifier's first recompute from `frontend/` failed to open the file | 0 failed fingerprint recomputes | S | proposed |
| 6 | Plugin: `sdd-engineering/agents/plan-verifier.md` (marketplace repo) | Count the summary roll-up per AC bullet of the plan, not per table row | Summary "12 MET" was later corrected to 14 MET in the same report | Summary count equals the number of AC bullets | S | proposed |

## 6. Trend

First entry.
