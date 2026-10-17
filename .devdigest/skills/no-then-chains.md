# No .then() chains

This codebase is async/await throughout. In code ADDED by the diff:

- `.then()` / `.catch()` / `.finally()` chains are a WARNING. Rewrite with
  `await` and `try`/`catch`.
- `.forEach` with an async callback is a WARNING: it does not await, so errors are
  unhandled and ordering is not what it looks like. Use `for...of` with `await`,
  or `Promise.all(list.map(...))` when the work is genuinely parallel.
- A floating promise — a call returning a promise that is neither awaited nor
  explicitly `void`-ed — is a WARNING.

Do not flag `.then()` in code the diff merely moves without changing.