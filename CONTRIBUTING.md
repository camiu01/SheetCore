# Contributing

## Documentation standard

Write project documentation, architecture decisions, code identifiers and
comments in English. UI copy belongs in `src/ui/it.ts`; imported game labels
are not translated or rewritten.

Use JSDoc/TSDoc-compatible comments on exported domain functions, public
interfaces, registries, and safety-sensitive boundaries. Describe contracts,
ownership, limits and failure behavior, not an English translation of each
statement. TypeScript carries parameter types; do not duplicate them using
`{Type}` annotations.

```ts
/**
 * Import an immutable source snapshot without changing existing characters.
 * @param original - Exact JSON text, preserved for reproducible export.
 * @returns A validated preview; no storage writes occur here.
 * @throws If JSON structure or safety limits are invalid.
 * @remarks Unsupported features are diagnosed, never emulated.
 * @see https://docs.rpg-companion.app/System/RPGSystem
 */
```

Keep README commands executable and keep the compatibility matrix aligned
with tests. New limitations need a visible diagnostic, a documented example
path, and a regression test. Do not document a proposed test as executed.

## Extending compatibility

1. Read the actual documentation page and a pinned real example.
2. Record source ID/version/commit, exact JSON pointer, semantics, ambiguities,
   and independently expected values in `docs/COMPATIBILITY.md`.
3. Check official tools and licenses before implementing parsers or compilers.
4. Add a formula/view handler and its allowed fields. Do not accept a field
   unless its behavior is implemented or explicitly diagnosed.
5. Add unit tests and a real-path integration test. For rule effects, first
   establish event scoping, lifecycle order, reversal, and aggregation semantics.
6. Keep source documents immutable. Never silently migrate saved characters.
7. Run `npm run check`, `npm run build`, and `npm run test:e2e`.

## Safety and data

Never execute imported JavaScript, use `eval`/`new Function`, interpret HTML,
or import Node filesystem modules into browser code. Keep local fixtures under
`.reference/`; do not commit third-party creative content without verified
redistribution rights and attribution. Preserve user changes and data.

The rules engine must remain independent of React. Use Dexie transactions for
cross-record mutations. A backup validation error must leave all existing
records untouched. Do not add a required cloud or account.
