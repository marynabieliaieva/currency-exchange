Flag changes that violate any rule below and cite the offending `file:line`.


## Naming: Interfaces and type aliases use PascalCase.

Detected in `server/src/platform/trace-builder.ts:19`

```
export interface BuildTraceInput {
```

## Error handling: Custom error classes set this.name to the class name for reliable type checking.

Detected in `server/src/platform/resilience.ts:9`

```
this.name = 'TimeoutError';
```