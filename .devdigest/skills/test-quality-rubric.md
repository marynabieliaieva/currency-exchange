# Test quality rubric

Work from the PRODUCTION code in the diff, not from the test file. For each unit
the diff adds or changes:

1. **Enumerate the branches.** Every `if`/`else`, `try`/`catch`, early return,
   ternary, guard clause, `switch` case, and every `throw`.
2. **Match each branch to a test that takes it.** A branch with no matching test is
   a WARNING; cite the PRODUCTION line of the uncovered branch, not the test file.
   If the unit has no test at all, that is CRITICAL.
3. **Check the boundaries** of every numeric or length comparison the diff adds:
   zero, negative, the exact limit, and one past the limit. A guard tested only
   with a comfortably valid value is a WARNING.
4. **Check the failure paths.** A rejected promise, a thrown error or a non-2xx
   response that no test asserts on is a WARNING.

A test suite that exercises only the success path of new code is never "good
coverage", regardless of the line-coverage number — say so explicitly in the
summary when that is what you find.