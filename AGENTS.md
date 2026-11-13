# Agent instructions

## Project

SheetCore is a responsive, local-first RPG companion PWA, not a landing page or
JSON editor. Use the existing React, strict TypeScript, Vite, Tailwind, Dexie,
Zustand, Workbox, Vitest, React Testing Library and Playwright stack.
Do not add a backend, accounts, analytics or required cloud services.

Read `CONTRIBUTING.md` and the relevant documents before changing behavior:

- `docs/ARCHITECTURE.md`: ownership, persistence and safety limits.
- `docs/COMPATIBILITY.md`: verified source contracts and unsupported features.
- `docs/COMBAT.md`: encounter commands and initializer restrictions.
- `docs/VERIFICATION.md`: executed checks, not promises.
- `docs/CI_CD.md`: GitHub Actions and Pages deployment.
- `NOTICE.md`: source provenance and redistribution restrictions.
- `.factory/threat-model.md`: trust boundaries and accepted security risks.

More specific directory instructions take precedence within their scope.

## Language and implementation

- Write documentation, identifiers and JSDoc/TSDoc in English.
- Keep application UI copy Italian, centralized in `src/ui/it.ts`. Preserve
  imported labels in their original language.
- Match the existing notebook-style UI, CSS tokens, accessible controls and
  responsive layout. Do not introduce a second design system.
- Keep rule evaluation independent of React. Use the existing formula/view
  registries, domain validators and persistence operations.
- Zustand holds ephemeral UI state; Dexie owns persistent domain data.
- Prefer existing helpers and dependencies. Do not add a package for a small
  operation supported by the platform.
- Document public and safety-sensitive contracts, especially validation,
  ownership, limits and failure behavior. Do not add explanatory noise.

## Source integrity and compatibility

- Preserve exact imported JSON text, including a BOM, and exact compressed
  `.rpg` bytes. Do not reserialize or recompress originals for export.
- Imports are immutable, identified by source ID/version and exact-upload hash.
  Never overwrite a version or silently migrate existing characters.
- Distinguish monolithic system JSON, split authoring sources, RPGScript,
  compiled distributions, resource archives and SheetCore internal backups.
  Supporting one does not establish support for the others.
- Before implementing a rule, inspect its documentation and a pinned real
  example. Record the source revision, exact path, semantics, uncertainties
  and independently expected results in `docs/COMPATIBILITY.md`.
- Do not invent RPG rules, coerce invalid source constants, replace real
  calculations with convenient defaults or simulate unsupported effects.
- Implement a field's behavior before accepting it as supported. Merely adding
  a registry entry, allowlist key or context name is not an implementation.
- Keep unknown/unsupported behavior visible. Do not silence warnings, relabel a
  partial system as complete or weaken validation to make an import pass.
- The diagnostics UI displays only the first 100 entries. Inspect the complete
  diagnostic array when investigating a report; the visible list is not the
  entire compatibility surface.
- `$view` must reflect real scoped input drafts, validation and save/cancel
  behavior. An empty placeholder or a copy of committed character values is
  not a substitute for an implemented view session.
- Preserve lambda/resource scope isolation, optional-path semantics, cache
  correctness and shared evaluation budgets when extending formulas.
- Do not roll dice or run initialization during rendering, reopening or restore.
  Combat initialization runs only through an explicit atomic command.

## Persistence and safety

- Preserve user changes, imported systems, characters and local browser data.
  Never clear storage, reset a database or remove files to make a test pass.
- Validate at untrusted boundaries. Retain byte, decompression, node, depth,
  collection, image and evaluation limits. Do not raise limits to hide failures.
- Never execute imported JavaScript, use `eval`/`new Function`, render raw imported
  HTML or expose object prototypes through stat paths.
- Keep remote image URLs inert. Local photos use bounded PNG/JPEG validation.
- Resource references must resolve to the correct type and exact system import.
  Notebook links are separate metadata and do not equip items or apply effects.
- Character/combat field commands must patch the latest persisted record.
  Use Dexie transactions for related writes and preserve unrelated concurrent edits.
- Validate an entire backup before replacement. A failed command or restore
  must leave existing data unchanged. Preserve supported legacy backup readers.
- Keep secrets and user-generated data out of source, logs, screenshots intended
  for publication and remote requests.
- Keep external fixtures under gitignored `.reference/`. Do not bundle them in
  `src/`, `public/`, `dist/` or Git without verified redistribution rights.

## Validation

For application changes, run from the repository root and stop on failures:

```powershell
npm run check
npm run build
npm audit --omit=dev
```

Then test the production build on an isolated port. Leave an existing user
preview on port 4173 running:

```powershell
$env:PLAYWRIGHT_PORT = '4183'
$env:PLAYWRIGHT_BASE_PATH = '/SheetCore/'
npm run test:e2e -- --max-failures=1
```

Also test `PLAYWRIGHT_BASE_PATH='/'` when changing routing, assets, the worker
or deployment behavior. PowerShell 5.1 does not support `&&` or `||`; check
`$LASTEXITCODE` when scripting dependent commands.

- Reproduce each reported symptom before fixing it. Cover its original input
  and state, not only a simplified replacement fixture.
- Add regression tests with independent expected results. Test error paths,
  empty/null inputs, nested scopes, repeated operations and concurrent edits
  where the change affects them.
- Test UI changes through actual controls, on desktop and mobile. Verify draft
  validation, save/cancel, offline reopening and backup restoration as applicable.
- Wait for the save transaction to finish before testing reload persistence.
- Real-source tests use local-only pinned fixtures and may explicitly skip on
  a clean checkout. Report skips; never describe them as verified integrations.
  Preparation commands are documented in `README.md`.
- Use `LIVE_RPG_IMPORT=1` only for an intentional live, read-only provider check.
  Controlled HTTP fixtures do not establish public-host availability or CORS.
- Run final checks against the delivered code. Update `docs/VERIFICATION.md`
  honestly; do not copy historical counts as current results.
- Documentation-only changes need content/path/diff checks, not an unrelated
  full application test run.

## Git and delivery

- Inspect status and diffs before editing and before committing.
- Commit or push only when requested for the current work. Use the configured
  Git identity; never override it, force-push or bypass hooks.
- Review staged files for unrelated work, secrets, generated artifacts and
  third-party content. Keep `.reference/`, `dist/` and test output untracked.
- Publish only `dist/` through the configured gated workflow. Do not change
  remote settings or claim deployment success without authorization and evidence.
- Report what changed, which checks passed or failed, and relevant remaining
  limitations. Do not claim full RPG-system compatibility from successful parsing.
