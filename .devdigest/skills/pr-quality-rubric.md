# PR quality rubric

Score the PR 0-100 as the weighted sum of four axes. State the per-axis scores in
the summary so the author can see where the number came from.

| Axis | Weight | 100 looks like | 0 looks like |
|---|---|---|---|
| Correctness | 40% | Every branch behaves as the PR claims | A reachable path is plainly wrong |
| Tests | 25% | New behaviour is covered, including its failure paths | New logic ships untested |
| Clarity | 20% | Names and structure explain the intent without comments | Reader must reconstruct the intent |
| Scope | 15% | One coherent change | Unrelated refactors ride along |

Rules:
- Never award an axis full marks "by default" — cite the diff line that earns it.
- A CRITICAL finding caps the total at 60, whatever the other axes say.