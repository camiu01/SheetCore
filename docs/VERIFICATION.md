# Executed verification

Run locally on 2026-11-13 on Windows, Node.js 24.13.1, npm 9.2.0.
This is a development verification record, not a compatibility certification.

| Check | Executed result |
| --- | --- |
| `node scripts/inspect-archer.mjs` | Passed; pinned gzip-JSON system extracted locally |
| `node scripts/package-fixtures.mjs` | Passed; both pinned original `.rpg` blobs exported locally |
| `npm run test:external` | Passed; two required historical-source integration tests |
| `npm run check` | Passed strict TypeScript and all 107 tests in eight files; external tests ran, none skipped |
| `npm run build` | Passed; production PWA, 11 precache entries, 613.40 KiB total precache |
| `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/SheetCore/ npm run test:e2e -- --max-failures=1` | Passed all 30 tests under a Pages-style subdirectory, no skips, 53.5 seconds |
| `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/ LIVE_RPG_IMPORT=1 npm run test:e2e -- --max-failures=1` | Passed all 30 tests at the origin root, no skips, 54.8 seconds; includes two actual public Raw imports |
| `PLAYWRIGHT_PORT=4183 LIVE_RPG_IMPORT=1 npm run test:e2e -- --grep 'direct raw .rpg'` | Passed two additional unmocked public Raw import checks, desktop/mobile, 9.0 seconds |
| Workflow YAML and configuration checks | Parsed YAML and verified triggers, job dependencies, privileges, action SHA pins, artifacts; three valid and eight invalid path/port cases passed |
| `npm audit --omit=dev` | Rechecked after combat integration: zero known runtime dependency vulnerabilities |
| Targeted pre-commit security review | Reviewed 27 security-relevant modules/configurations; no remaining confirmed application finding; threat model and report retained |
| `npm audit --json` | Six build-tool dependency advisories: four moderate, two low, zero high/critical |

The inline environment assignments in the table describe the run; Windows
PowerShell uses `$env:NAME = 'value'` as shown in the README. Port 4183 isolates
acceptance runs from the user's active preview on 4173; no existing server or
user database was stopped or cleared. The full build-chain audit is from the
earlier dependency review; these features add no dependencies.

## Browser coverage

Playwright ran production `dist/` in Chromium at desktop 1440 × 1000 and Pixel 7
mobile emulation. Each profile covered:

1. Real file input, including retained UTF-8 BOM, import preview/confirmation,
   manual character creation, source fields, saved edits and derived values.
2. Worker activation, offline reload, character reopening, resource creation and
   notebook link, dice history, downloaded backup, confirmed deletion and restore.
   The restored backup retained values, resources, links, and rolls.
3. Malformed file rejection, unknown component fallback, and no imported code
   execution.
4. Locally intercepted HTTP 404, network/CORS failure, and permitted HTTPS JSON
   response. These are controlled browser fixtures, not public-provider tests.
5. Three manually created characters, persisted dark/light theme, keyboard focus,
   responsive layout, and no horizontal overflow on the tested screen.
6. The real historical ability slice and the entire extracted Archer `0.9.1`
   JSON document: visible partial support, source score `8 → 15`, modifier
   `-1 → 2`, save, offline reload, reopen.
7. The exact reported GitHub repository URL: identify an HTML/repository page
   before any download instead of labelling it an invalid URL/CORS failure.
8. Original Archer `0.9.1` and derpsy `0.6.0` `.rpg` files: real file input,
   partial-support warning, ability edit, offline reopen, exact original-byte
   export, backup v3 and restore, then byte-identical export again.
9. Direct Raw `.rpg` URL with the actual pinned bytes as a controlled HTTP
   response, malformed/unknown packages, and gzip distribution indexes.
10. Native browser decompression at the worst supported byte boundary:
    8,388,609 expanded bytes rejected without installation; exactly 8,388,608
    bytes accepted and installed. Both profiles passed.
11. Original MIT-licensed Sentieri gzip import, edit, offline reopen,
    byte-identical export and backup/restore, without third-party fixture files.
12. Production root/subdirectory pathname, manifest start/scope, worker
    script/scope and offline navigation. Both complete browser suites passed.
13. Typed scalar lists, same-version resource references, local PNG input,
    rejection of a truncated raster before saving, two combatants, manual
    initiative, turn/round advancement, offline reopening and backup v3 restore.
    HP initialization and saved turn state are retained rather than rerolled.

Separately, `LIVE_RPG_IMPORT=1` disabled request interception for the
[pinned derpsy Raw system file](https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg).
Both browser profiles downloaded and imported it over real HTTPS, then exported
bytes matching the pinned Git blob exactly. This verifies that endpoint's
browser access at the time of testing, not every server's CORS policy.

Desktop/mobile character-list screenshots were inspected. Screenshots and
failure traces are generated under gitignored `test-results/`; they do not ship.
Initial acceptance runs failed on navigation selectors and duplicate labels.
They also exposed off-canvas mobile navigation remaining keyboard-accessible.
The selectors were corrected and closed mobile navigation now uses CSS
visibility to leave the keyboard/accessibility tree. The final run passed.
The new GitHub-URL regression first reproduced the user's exact misleading
network/CORS text on the old build. The corrected run identifies the page
without requesting it. An initial acceptance launch found port 4173 occupied;
the harness now supports an isolated `PLAYWRIGHT_PORT`, leaving that app open.

The compatibility increment initially failed on an outdated backup-version test,
an optional-test skip API, native dice-resource setup and new browser selectors.
Tests now use the original `dice_roll` base fields, not a substituted calculated
formula. The offline helper waits for the asynchronous save transaction before
reload; checkbox assertions wait for the committed controlled value. Scalar-list
inputs remount when a removed item changes their value. Final runs above used the
hardened initializer and all passed.

## Unit and integration coverage

- Bounded formula evaluation, order, rounding, conditions, dependencies, cycles,
  caches, unsupported handlers, numeric errors, and no dynamic code.
- Cryptographic dice bounds and malformed expressions.
- Source schema/type validation, exact-source identities, unknown fields,
  UTF-8 preservation/rejection, prototype keys, byte/depth/node limits.
- Immutable versions, concurrent field edits, exact-version resource links,
  migration v1 → v2, reopening IndexedDB, bounded history.
- Backup validation, hashing, cross-record links, atomic replacement and rejection
  without modifying the live database.
- Source-driven rendering/editing, escaped HTML, visible unsupported events,
  null optional conditions, disabled checkbox, invalid numeric draft rejection.
- Pinned historical source errors rejected without coercion; unchanged selected
  source objects; six ability defaults and source note conditional behavior.
- Supplied Archer serialization/counts/dice and the persisted ability path.
- Gzip checksum/truncation errors, unknown envelopes, invalid UTF-8, source-byte
  identities, distinct gzip encodings of identical JSON, exact original bytes,
  unsupported native decompression, size-bounded/canonical Base64.
- Compressed/raw input and expanded size caps, including exact 8 MiB acceptance
  and one-byte-over rejection; oversized Content-Length and actual response body.
- Backups v2 and legacy v1 restore; reject v1 with binary fields, source/hash/JSON
  tampering, and invalid packages without modifying the live archive.
- Both pinned real gzip systems, unchanged source counts, and the real strength
  modifier; URL validation, GitHub pages, HTML, HTTP, network, timeout and decode
  error distinctions.
- Documented string/date/null/list/scoping examples, optional paths, nested lambda
  frames, dynamic stat names, cache bypass, safe resource paths, and no render-time
  randomness. Real source `created_at_display` matches the fixed expected date.
- Both original combat definitions: native dice-resource expression, one-time
  monster HP initialization, XP pool 50, source resolution on HP zero, healing,
  reopening and backup restore without rewriting source originals.
- Initiative ties, per-round/per-combat behavior, degradation passes, threshold
  rejection, atomic initializer failures, linked-PC concurrent field preservation,
  and rejection of malformed references/overrides/active state during restore.
- Unsupported initializer options, dynamic destinations, calculated aggregation,
  repeated destinations and implicit/concurrent sequences fail without partial
  persistence. Initializer resource references use the same integrity checks.
- Photo structural validation at the documented 1 MiB ceiling in a fresh Node
  process, over-limit rejection, canonical encoding and dimension bounds.

## Remaining warnings and unchecked cases

Build warnings remain for dependency `@__PURE__` comment annotations and the
559.58 kB minified main JavaScript chunk (170.43 kB gzip). No warning threshold
was raised to hide these messages.

The six audit entries belong to the development/build chain:
`vite-plugin-pwa`, `workbox-build`, `glob`, `minimatch`,
`@rollup/plugin-node-resolve`, and `deepmerge`. Runtime audit is clean.
Available upstream versions were checked; no unverified forced dependency
override or suggested major downgrade was applied. Recheck before releasing,
and build only trusted application source.

Not certified: Safari/Firefox, actual iOS/Android installation, assistive
technology or complete WCAG compliance, storage eviction/quota exhaustion,
two-version service-worker update rollout, static-host HTTPS/subpath deployment,
other third-party hosts' CORS policies, and sustained large-library performance.
The app has not been published to an external host. The Actions/Pages workflow
was inspected and its application commands exercised locally, not executed on
a GitHub-hosted Ubuntu runner. `npm ci` and browser/Linux dependency installation
were not rerun locally because the existing development installation was used.
Enable Pages and run the workflow on GitHub to verify hosted deployment.

External tests skip explicitly on a fresh checkout until their local-only inputs
are prepared. No third-party fixtures or compiled packages are distributed.
There is no full-system, generic compiled-package, creation-flow, general effect-engine,
or resource-pack compatibility claim. Only the independently verified gzip-JSON
system variant is supported, not the advertised book/class/race archives.
