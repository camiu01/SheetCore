# PolySheet

A responsive, installable, local-first character notebook for a **declared subset**
of RPG Companion JSON system definitions. React + strict TypeScript, Vite,
Tailwind CSS, Dexie/IndexedDB, Zustand, and Workbox. No backend, accounts,
analytics, required cloud services, or hard-coded game rules.

**This is an independent project, not the official RPG Companion application.
Importing a document does not establish full system compatibility.**

## Quick start

Use Node.js 22.12+ or 24 LTS and npm:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. In **Libreria sistemi**, import a
monolithic `.json`, a verified gzip-JSON system `.rpg`, or choose **Esplora Sentieri**. Review the preview and
confirm. Create a character with **Nuovo personaggio**. Creation is explicitly
**manual**, not an implementation of the original creation flow.

The distributed **Sentieri** example is original MIT-licensed content, not a
transcription of an existing ruleset. Its expected initial values are Vigore 2,
Ingegno 3, Istinto 1, Scorte 6, and calculated Slancio 3. Changing Vigore to 7
changes Slancio to 8. Imported systems determine their own fields and sections.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on loopback, no production offline worker |
| `npm run check` | Strict TypeScript check and unit/component/integration tests |
| `npm test` | Vitest tests; external cases explicitly skip when not prepared |
| `npm run test:watch` | Vitest watch mode |
| `npm run build` | Type-check and produce the static PWA in `dist/` |
| `npm run preview -- --port 4173` | Serve the production build locally |
| `npx playwright install chromium` | Install Chromium for acceptance tests |
| `npm run test:e2e` | Desktop and mobile acceptance tests against `dist/` |
| `npm run test:external` | Prepare pinned external inputs and require external integration tests |
| `node scripts/package-fixtures.mjs` | Prepare local-only pinned Archer/derpsy `.rpg` inputs from the reference clones |
| `node scripts/icons.mjs` | Rebuild committed PNG icons from the original SVG |
| `npm audit` | Inspect all dependency advisories |
| `npm audit --omit=dev` | Inspect runtime dependency advisories |

Build before running acceptance tests:

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

If your app preview already uses port 4173, keep it open and isolate tests:

```powershell
$env:PLAYWRIGHT_PORT = '4183'
npm run test:e2e
```

## Working features

- Local monolithic JSON import, bounded structural validation, semantic
  diagnostics, original-source retention, SHA-256 identity, and confirmation.
- Direct `.rpg` import for the verified gzip-JSON **system** variant, with
  independently bounded compressed/expanded size and exact original-file export.
- Optional direct HTTPS JSON/`.rpg` URL import, with distinct GitHub-page,
  HTML-response, HTTP, timeout, and network/CORS diagnostics.
- Public GitHub repository/`.git` discovery, optional branch/commit selection,
  file choice and commit-pinned preview. No clone, compiler or account.
  See [GitHub import](docs/GITHUB_IMPORT.md).
- Multiple immutable system versions. Existing characters never silently move
  to another import, including when the source ID/version has not changed.
- Multiple manual characters, source-generated supported sheet components,
  base-value editing, and controlled derived-stat evaluation.
- Scoped `$view` drafts, source validation and atomic Save/Cancel forms.
  Source popups, local note creation/selection, resource lists and manual
  creation-page input groups are described in [source views](docs/VIEWS.md).
- Local resource instances, plain-text detail views, manual notebook links to
  characters, editing, unlinking, and confirmed deletion.
- Typed resource references, scalar lists, local PNG/JPEG photos, and documented
  contextual list/text/date formulas. Remote photo URLs remain inert.
- Source-defined encounters with persisted combatants, one-time instance
  initialization, initiative, turns, rounds, difficulty and source XP summaries.
  See [combat usage and exact limits](docs/COMBAT.md).
- Bounded `xdy +/- n` manual dice rolls using cryptographic randomness and
  persistent, configurable history.
- IndexedDB database migration v1 → v2 → v3, transaction-safe edits, versioned
  application backups, validation before destructive restore, and atomic restore.
- Italian UI, light/dark theme, keyboard-accessible controls and dialogs,
  responsive layouts, save/network indicators, and service-worker update prompt.
- Offline production app shell, imported definitions, saved characters,
  resources and history after the first successful online load.

## Compatibility and real source evidence

Read [the compatibility matrix and source audit](docs/COMPATIBILITY.md) before
using an external system. It records documentation links, exact example paths,
expected behavior, tests, discrepancies, and deferred features.

Reference repository:
[blastervla/rpg-companion-app-systems](https://github.com/blastervla/rpg-companion-app-systems).

- Current source inspection:
  [8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4).
  Actual system directories: `systems/5e/`, `systems/5e2024/`, `systems/pf2e/`.
  `systems/_stdlib/` is shared macro source, not a game system.
- Historical monolithic integration input:
  [92b8128a1e6da7ed39406012e357d1e3d0e1792b](https://github.com/blastervla/rpg-companion-app-systems/tree/92b8128a1e6da7ed39406012e357d1e3d0e1792b),
  `systems/5e/system.rpg.json`, system version `0.5.1`.
- Full historical input contains invalid typed constants and is **not installable**
  under this interpreter's documented validation. The external tests assert
  those errors rather than coercing them.
- A clearly labelled, mechanically selected **ability/notes subset** retains
  source stat/view/resource objects unchanged. It is not a full 5e implementation.
  The original section's icon renders; unsupported roll events remain visible.

### Prepare external tests locally

Third-party creative content is **not distributed** in `src/`, `public/`, or
`dist/`. The reference checkout and generated files stay under gitignored
`.reference/`. Check its license before local use or redistribution.

```sh
git clone https://github.com/blastervla/rpg-companion-app-systems.git .reference/rpg-companion-app-systems
npm run test:external
npm run build
npm run test:e2e
```

If you already have a full checkout elsewhere, set `RPG_SYSTEMS_REPO` to its
absolute path. A shallow checkout must contain the pinned historical commit.

```powershell
$env:RPG_SYSTEMS_REPO = 'C:\absolute\path\rpg-companion-app-systems'
npm run test:external
```

`scripts/external-fixture.mjs` exports the exact Git blob to
`.reference/5e.json`. The external test also writes
`.reference/5e-slice.json`, an explicitly reduced JSON input usable in the UI
and offline browser tests. No formula, event, or resource semantics are rewritten.

### Additional user-provided repository: Archer-class

The supplied repository is
[WaMXXVII/Archer-class](https://github.com/WaMXXVII/Archer-class), inspected at
[378bdf68f055bae8777a233fc0ac6e4f9eb6145c](https://github.com/WaMXXVII/Archer-class/tree/378bdf68f055bae8777a233fc0ac6e4f9eb6145c).
It contains compiled distribution artifacts, not a JSON authoring tree.
For this exact revision, `5e/system.rpg` is an observed gzip-JSON payload:
system `5e` version `0.9.1`, 317 stats, 50 resource definitions, and six dice.

```sh
git clone https://github.com/WaMXXVII/Archer-class.git .reference/Archer-class
node scripts/inspect-archer.mjs
npm run check
npm run build
npm run test:e2e
```

The inspection script reads the pinned Git blob, bounds decompression, and
writes `.reference/archer-system.json`. You can import that JSON manually.
The full document passes interpreted-field validation, but its unsupported
mechanics, effects, views and contextual formulas are still reported.
Tests verify the ability-score path, not full 5e or the Archer class.
The separate resource-instance archive is **not imported**.

The inspection script is optional: the browser can now import the original
`5e/system.rpg` directly. Its exact gzip bytes are retained; existing characters
using an earlier extracted JSON remain pinned to that different source import.
This is not a generic `.rpg` decoder or a Git client. No license was found in the
provided repository; none of its content is bundled. A GitHub Pages base URL
returning 404 does not by itself prove its distribution endpoints are broken.

### Import the reported third-party repository's system

[derpsyhome/3rd-party-books-for-5e](https://github.com/derpsyhome/3rd-party-books-for-5e)
was inspected at
[00f55b2c3023c59f5857297dc933a7505c9b6aa4](https://github.com/derpsyhome/3rd-party-books-for-5e/tree/00f55b2c3023c59f5857297dc933a7505c9b6aa4).
Its `5e/system.rpg` is gzip-JSON for `5e` version `0.6.0`.

In **Da URL**, paste the
[pinned direct system URL](https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg),
or download that file and choose it with **Scegli file JSON o .rpg**.
Alternatively, paste the repository's root URL, with or without `.git`, set the
optional branch/commit, and select `5e/system.rpg` from the discovered files.
GitHub discovery uses the public API, not the repository's HTML page.
`blob`/`tree` page URLs are not accepted; use the root URL and reference field.

This imports the **system definition**, not the advertised books/classes/races
contained in `resources.rpg.gzip`. Resource archives, `systems.rpg` distribution
indexes, unknown binary `.rpg` formats and `.rpgs` source are rejected explicitly.
Successful decoding does not mean complete rule compatibility.

For reproducible local-only binary tests:

```sh
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/derpsyhome/3rd-party-books-for-5e.git .reference/derpsy-books
node scripts/package-fixtures.mjs
npm run check
npm run build
npm run test:e2e
```

The Archer checkout from the preceding section is also required. The fixture
script exports the pinned Git blobs, not the mutable working-tree files.
To run just the live public Raw import check (read-only, no intercept):

```powershell
$env:PLAYWRIGHT_PORT = '4183'
$env:LIVE_RPG_IMPORT = '1'
npm run test:e2e -- --grep 'direct raw .rpg'
Remove-Item Env:LIVE_RPG_IMPORT
```

Backups now export **PolySheet v3**, retaining original gzip bytes and encounters.
Restore accepts previous **v1** JSON-only and **v2** backups. Older app versions cannot restore v3;
no existing database or character is migrated to a different import.

## Explicit limitations

- **A:** Monolithic source JSON is supported only for the matrix subset.
- **B:** Split directory composition/merge is not implemented.
- **C:** RPGScript `.rpgs` is not compiled or executed.
- **D:** Only the verified gzip-JSON system `.rpg` variant is decoded.
  This is not a general binary decoder, resource-archive reader or compiler.
- **E:** PolySheet characters, local resource records, preferences and backups
  use an **internal format**, not an RPG Companion character export format.
- No official character-creation pages, general lifecycle/event/mechanic engine,
  progression, enumerated selectors, general modifier/override
  stacking, or 3D dice. Combat supports only its documented command subset.
  `$view` exists only inside implemented edit sessions, not as a global
  placeholder. Manual field groups do not execute official page visibility/hooks.
- Unknown components and fields are preserved and reported. Rule-affecting
  omissions make a system only partially usable. Invalid interpreted fields
  block installation.
- Notebook links do **not** equip items or activate mechanics. The separate typed
  base editor can explicitly assign local references to resource-valued stats.
- Descriptions are rendered as plain text. HTML/Markdown is not interpreted.
  Remote images are not fetched, cached, or claimed to work offline.
- Data belongs to this browser profile and origin. Private browsing, storage
  eviction, or clearing site data can remove it. Export backups regularly.
- Backups support at most 32 MiB and the documented record limits. Imports
  support 8 MiB compressed **and** 8 MiB expanded. Gzip imports need a browser
  with native `DecompressionStream`. See [architecture and safety limits](docs/ARCHITECTURE.md).

## Static deployment and offline use

Deploy **only `dist/`** on an HTTPS static host. No server API is needed.
`base: './'` supports deployment under a subdirectory. The app uses in-memory
screen navigation, so it does not require server-side route rewriting.

The production worker precaches the app shell and local icons. IndexedDB stores
user imports and records independently of the worker cache. Offline use starts
after the first successful production load and worker activation. `npm run dev`
does not prove offline operation. Update prompts use Workbox's waiting-worker
flow; leave the current field and wait for “Salvataggio in corso…” to finish
before reloading or updating.

Recommended host headers: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, a restrictive content security policy, and
`Cache-Control: no-cache` for `index.html`, `sw.js`, and the manifest.
Allow HTTPS `connect-src` only if URL imports are desired. Do not cache an old
worker script indefinitely.

### GitHub Actions and GitHub Pages

The [CI and Pages workflow](.github/workflows/ci-pages.yml) checks pull requests,
pushes to `main`, and manual runs. It installs locked dependencies, audits runtime
dependencies, checks types, runs tests, builds the PWA, and tests desktop/mobile
under `/PolySheet/`, including offline and exact `.rpg` backup/export.

Only a successful push or manual run **on `main`** can publish `dist/` to Pages.
Pull requests and manual runs on other branches never deploy. Enable
**Settings → Pages → Build and deployment → Source: GitHub Actions** in your
GitHub repository before the first deployment. No personal access token is needed.

See [CI/CD setup, protections, test scope and recovery](docs/CI_CD.md).
Adding these files does not itself push code or publish a site.

## Documentation and contributions

Code comments and project documentation are in **English**. Public boundaries,
domain operations and safety-sensitive functions use **JSDoc/TSDoc-compatible**
comments with `@param`, `@returns`, `@throws`, `@remarks`, and `@see` where useful.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the documentation and extension rules.
The initial UI catalogue is Italian in `src/ui/it.ts`; imported labels are kept
in their original language.

See [the executed verification record](docs/VERIFICATION.md) for results and
remaining build-tool dependency advisories.

## Licenses

New application code, original Sentieri data, original icons, and original
decorative artwork: [MIT](LICENSE.md). Dependency licenses remain their own.

No reference build tool has been copied. External game content and images are
not covered by the application MIT license. The reference `LICENSE.md` says
CC BY-NC 4.0 while its README/site say CC BY-NC-SA 4.0. This conflict is
documented, not silently resolved. See [NOTICE.md](NOTICE.md).