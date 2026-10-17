# API contract gate

For every route handler or shared schema the diff touches, diff the OLD signature
against the NEW one, field by field, and classify each difference:

**Breaking (CRITICAL)** — an existing caller that does not change starts failing:
- a parameter added as required, or made required after being optional;
- a parameter, response field or enum member removed or renamed;
- a type narrowed (string → enum, wider range → narrower, nullable → non-null);
- a path, method or status code changed;
- a default value changed so existing behaviour silently differs.

**Silent (WARNING)** — same shape, different meaning: pagination defaults,
ordering, rounding, timezone, null-vs-absent1

**Safe** — a new optional parameter with a default, a new response field, an
entirely new route.

Always name the caller that breaks and how, e.g. "a client that omits `currency`
now receives 422 where it previously defaulted to USD". Offer the compatible
alternative: keep it optional with the old default, add a field alongside rather
than renaming, or version the route.