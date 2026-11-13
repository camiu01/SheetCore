# Repository Guidelines

## Required reading

Read [the detailed agent instructions](docs/AGENT_INSTRUCTIONS.md) and
[CONTRIBUTING.md](CONTRIBUTING.md) before changing this repository. Their
requirements remain mandatory. Read the relevant architecture, compatibility,
combat, verification, deployment, provenance and threat-model documents listed
there. More specific directory instructions take precedence.

## Project structure

PolySheet is a local-first RPG companion PWA built with React, strict TypeScript,
Vite, Tailwind and Workbox. Do not add a backend, accounts or analytics.

- `src/domain/`: contracts and validation.
- `src/engine/`: React-independent formulas and view sessions.
- `src/importing/`: source parsing and compatibility diagnostics.
- `src/persistence/`: Dexie storage, transactions and backups.
- `src/ui/`: notebook-style controls and Italian copy in `it.ts`.
- `tests/`: Vitest tests; `tests/e2e/`: Playwright acceptance tests.
- `public/`: static assets; `scripts/`: fixture and asset tooling.
- `.reference/`: gitignored external fixtures; `dist/`: generated production build.

## Development and validation

Use Node.js 22.12+ or 24 LTS and npm. Run commands from the repository root:

```sh
npm ci
npm run dev
npm run check
npm run build
npm audit --omit=dev
PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/PolySheet/ npm run test:e2e -- --max-failures=1
```

`check` runs TypeScript and Vitest. Playwright tests the production build on
desktop and mobile. Stop on failures; preserve any preview on port 4173.
Also test `/` for routing, asset, worker or deployment changes.
Documentation-only changes require content, path and diff checks.

## Coding and testing conventions

Follow existing two-space indentation, single-quoted TypeScript strings,
PascalCase components and camelCase functions. No formatter or linter script
is configured. Write documentation, identifiers and contract comments in English;
keep UI copy Italian and imported labels unchanged.

Dexie owns persistent data; Zustand holds ephemeral UI state. Reuse existing
registries and helpers. Preserve exact source bytes, validation limits and user
data. Never execute imported code or simulate unsupported rules.

Use `*.test.ts` or `*.test.tsx` with Vitest and React Testing Library.
Reproduce reported bugs with original inputs and add independently expected
regressions. Report skipped external fixtures and record executed checks in
`docs/VERIFICATION.md`.

## Commits and pull requests

Inspect status and diffs; preserve unrelated work. Commit or push only when
requested. Prefer short imperative subjects, using existing `feat:` style when
appropriate. Describe scope, compatibility limits and checks in PRs; include
screenshots for UI changes and link relevant issues. Never commit secrets,
external fixtures or generated test/build output.
