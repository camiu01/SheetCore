# Executed verification

This is a development verification record, not a compatibility certification.

## Pre-push root-hosting check

Executed on 2026-11-14 on Linux without application-code changes.

- `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/ npm run test:e2e -- --max-failures=1 --grep "production assets"`:
  **2 passed**, desktop/mobile. Verified root asset URLs, manifest, service-worker
  scope and offline reload. The existing production build was used.
- The full application checks and subdirectory browser suite remain recorded
  below; they were not repeated for this commit-only request.

## Reported AC, race and avatar menu follow-up

Executed on 2026-11-13 on Linux against the delivered application code.

- `npm run check`: TypeScript passed; **139 passed, 11 skipped** across
  13 files. Skips are absent historical external fixtures. The exact local
  reported upload was present and exercised.
- `npm run build`: passed; main JS 624.43 kB (188.20 kB gzip), CSS 37.59 kB,
  11 precache entries (681.64 KiB). Existing Zod annotation and >500 kB chunk
  warnings remain.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright, port 4183, `/PolySheet/`: **30 passed, 10 skipped**
  across desktop/mobile. Skips are absent historical fixtures and the optional
  live provider case. No port-4173 preview was stopped.
- Reproduced original empty-class AC and null-race description errors. Actual
  manual controls create and assign class, class-details and race records;
  Dexterity 14 gives AC 12 and the source-derived description. HP 14, AC,
  description and exact compressed source bytes survive offline/backup restore.
- Current original menu and `$edit_mode` rendering were already functional;
  their reported unsupported/missing-stat messages were not reproduced.
  Imported lifecycle and information events remain unexecuted and visible.
- A red renderer regression reproduced a false runtime warning for a null
  avatar event. Non-null unsupported event warnings remain after the fix.
  Import diagnostics and immutable source content are unchanged.
- An initial browser selector matched two menus and was scoped to the avatar.
  The next run exposed a real mobile menu overflow/pointer failure. Right-edge
  alignment fixed it; both the exact-source case and an always-on MIT
  viewport/pointer regression passed in the complete final browser run.
- Root hosting, live providers, deployment and general event/creation support
  were not verified. No game-rule fallback, migration or dependency was added.

## Reported HP recovery increment

Executed on 2026-11-13 on Linux against the delivered application code.

- `npm run check`: strict TypeScript passed, **138 tests passed, 11 skipped**
  across 13 files. The skips are pre-existing absent real-source fixtures;
  the user-provided HP fixture was present and its regression ran.
- `npm run build`: passed; main JS 624.42 kB (188.22 kB gzip), CSS 37.52 kB,
  11 precache entries (681.56 KiB). Existing Zod annotation and >500 kB chunk
  warnings remain. No dependencies, database schema or stored imports changed.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright on isolated port 4183, `/PolySheet/`: **28 passed,
  10 skipped**, desktop/mobile. The skips are absent historical Archer/derpsy
  and external-subset fixtures or their optional live source case.
- The exact reported upload reproduced the empty-class failure. Completing
  `Class` and `Class details` through actual manual resource controls and
  assigning the character's typed `Classes` field produced maximum HP 14 for
  independently entered level 2, Constitution 14 and base HP 10. Both browser
  profiles retained that result offline and after backup replacement; the backup
  retained exact original compressed bytes.
- Always-on regressions cover strict `notNull` behavior, invalid/missing nested
  formulas, lambda cleanup, local child-render error isolation and retry,
  discarded source drafts, Cancel, failed-reference rollback, retained failed
  drafts, busy state and unrelated concurrent field/archive-name preservation.
- The original class source form has duplicate `class_edit_base_ac` IDs.
  It remains invalid rather than being rewritten. The manual editor explicitly
  distinguishes typed data validation from source-form rule validation.
- Initial red tests confirmed the missing manual control and unsupported
  `notNull`; an intermediate type check and a test database reopening failure
  were corrected. Initial browser attempts used an unsuitable label selector
  and immediate checkbox-state check; final acceptance uses accessible roles
  and waits for the persisted assignment. The complete final suite above passed.
- No port-4173 preview was stopped. Root-path acceptance, live providers,
  deployment and general creation/archetype/leveling compatibility were not
  verified for this increment.

## Previous contributor guide and diagnosis-only investigation

Checked locally on 2026-11-13 on Linux.

- Root `AGENTS.md`: 367 words; required title and linked paths checked.
  The previous detailed instructions were retained in
  `docs/AGENT_INSTRUCTIONS.md`, including existing uncommitted project renames.
- An assertion harness loaded the actual import, initial-value and evaluator
  modules through Vite and read the user-provided `system.rpg` without changing
  it. The upload hash and exact formula paths are recorded in
  [compatibility](COMPATIBILITY.md#reported-empty-class-hp-failure).
- Original defaults independently checked: `classes=[]`, `level=0`, `base_hp=1`.
  Both reads of `max_hp` reproduced
  `max_hp: classes_hp_mods: max richiede una lista non vuota`.
  Repeated direct reads of `classes_hp_mods` also failed as expected; the
  complete input snapshot remained unchanged.
- Full static diagnostics: 0 errors, 1,683 warnings. The public `max`
  documentation was read and explicitly requires a nonempty numeric list.
  No arbitrary fallback, source mutation or compatibility claim was added.
- The first harness run also emitted a dependency-scanner error for the
  app's virtual PWA module, despite completing the assertions. The final run
  disabled unrelated dependency discovery and passed without that error.
- No application code changed. Application suites, production build, runtime
  audit and browser tests were not rerun. Populated-class behavior, browser UI,
  live source providers and deployment were not verified.

## Current source-view increment

Historical run on Windows, Node.js 24.13.1, npm 9.2.0.

- `npm run check`: passed strict TypeScript and 144 tests in twelve files;
  11 skips are local-only real-source fixtures absent from a clean checkout.
  The new `tests/source-views.test.tsx` covers enumerated `select` options with
  inherited entries and allowlists, `collapsible`/`viewPager` paging, `ticker`
  bounds and direct edits, `$edit_mode` visibility, `button`/`menuButton` events
  staying disabled and visible, and `resourceArray` display mode.
- `npm run build`: passed; main JS 622.54 kB, 187.63 kB gzip; CSS 37.49 kB;
  11 precache entries, 679.70 KiB. Existing Zod annotation and >500 kB chunk
  warnings remain. No dependencies or database schema changed.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright on port 4183 with `PLAYWRIGHT_BASE_PATH=/PolySheet/`:
  **26 passed, 10 skipped**, matching the previous baseline; the skips are the
  external fixtures that are not present locally.
- Pinned `system.rpg` diagnostics after the increment: **0 errors, 1,683
  warnings** (previously 1,875), with 0 unsupported view instances, 85
  unsupported formula nodes, 129 unresolved references and explicit reports for
  the 19 source button events, `resource.create_if_empty` and `diffText`.
  This is not a claim of full runtime compatibility.

## Previous GitHub retrieval increment

- `npm run check`: passed strict TypeScript and 137 tests in eleven files,
  no skips. Eleven GitHub groups verify URL normalization, default/explicit
  references, commit pinning, selection, byte/tree/candidate bounds at their
  declared limits, unsafe/incomplete metadata, public-API failures, exact
  originals and immutable character pins through backup restoration.
- `npm run build`: passed; main JS 601.03 kB, 181.99 kB gzip; CSS 34.41 kB;
  11 precache entries, 655.69 KiB. Existing Zod annotation and >500 kB chunk
  warnings remain. No dependencies or database schema changed.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Final production Playwright on port 4183: **36/36 passed at `/PolySheet/`
  and 36/36 at `/`**, no skips. The two suites and the live check below took
  168.4 seconds for all three sequential commands.
  Controlled GitHub/Raw responses exercise the real clone-URL UI, reference
  encoding, file selection, invalid-content rejection, cancellation before
  installation, confirmation, exact export, offline reopening, rate limits,
  missing repositories and authoring-only trees. Existing acceptance passed.
- Separate intentional live public GitHub check: **2/2 passed**, desktop/mobile,
  9.8 seconds reported by Playwright, no intercepts. The real API resolved
  derpsy commit `00f55b2c3023c59f5857297dc933a7505c9b6aa4`, listed the tree,
  downloaded `5e/system.rpg`, and displayed version `0.6.0` with 317 stats.
  This establishes the observed public API/Raw availability and browser CORS,
  not continued availability or full RPG runtime compatibility.
- Pre-commit review reproduced a reserved view-ID validation failure:
  `__proto__` lost its error in a normal object dictionary. A null-prototype
  dictionary now retains validation for that ID, `constructor` and `toString`.
  The new regression verifies blocked Save. All final checks above ran after
  this correction. The focused security review records no remaining confirmed
  findings in the reviewed changes; it is not a penetration test.
- The existing preview on port 4173 was retained. Hosted deployment was not
  verified. Private repositories, non-GitHub Git hosts, arbitrary cloning,
  split-source compilation and resource archives remain unsupported.

See [GitHub contract and usage](GITHUB_IMPORT.md).

## Previous scoped-view increment

- `npm run check`: passed strict TypeScript and 125 tests in ten files, no skips.
  Eleven scoped-view regressions cover immediate draft validation, failed saves,
  nested Save/reopen/Cancel with combat overrides, exact-pin resource lookup,
  concurrent appends, invalid multi-field rollback, foreign additions, linked-PC
  combat writes and immutable backup originals. Both pinned original systems'
  six point-buy inputs and source cost calculations are exercised.
- `npm run build`: passed after the final application change; main JS 594.43 kB,
  179.75 kB gzip; CSS 34.37 kB; 11 precache entries, 649.21 KiB.
  Existing Zod annotation and >500 kB chunk warnings remain.
- Final production Playwright on isolated port 4183: **34/34 passed at
  `/PolySheet/` and 34/34 at `/`**, desktop/mobile, no skips; 147.8 seconds for
  the two sequential commands. The existing user preview on 4173 was retained.
  Tests use original Archer/derpsy popups, condition Save/Cancel, the six source
  point-buy inputs, validated note creation, local resource ordering/unlinking,
  offline reopening, exact source exports and backup restoration.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
  No dependencies or database schema changed.
- Earlier intermediate browser assertions/builds are not the final evidence.
  Nested popup reopening was corrected to prefer staged preview values over
  original combat overrides; final unit/build/browser checks ran afterwards.
- Full diagnostics for the attached derpsy `5e` `0.6.0` original were inspected,
  not just the first 100 displayed entries: 1,875 warnings and no static errors.
  This is not full runtime compatibility. Empty `classes` reproduces a null
  saving-throw proficiency and a strict boolean-condition error; null `race`
  reproduces required `race.current_level_traits` lookup failure. Neither was
  disguised with invented defaults.

General events, official creation/progression, nested resource contexts and
additional views/formulas remain unsupported. The manual source-input groups
are explicitly not an official character-creation workflow. See
[view contracts and limits](VIEWS.md).

Live public-provider checks and hosted deployment were not rerun for this
increment. URL tests used controlled responses. No commit, push or remote
settings change was performed.

## Previous collection-only increment

- `npm run check`: passed TypeScript and 114 tests in nine files, no skips.
  Seven new grouped regressions include both pinned original source variants,
  populated armor selection by actual local instance ID, strict input failures,
  lexical bindings, bounded flattening and required missing-race errors.
- `npm run build`: passed; main JS 562.21 kB, 171.07 kB gzip; 11 precache
  entries, 616.54 KiB. Existing Zod annotation and >500 kB chunk warnings remain.
- `npm audit --omit=dev`: zero known runtime dependency vulnerabilities.
- Production Playwright with port 4183 and `/PolySheet/`: 32/32 passed,
  no skips, 67.5 seconds including the command. Desktop and mobile exercise
  all six new handlers through real imported views and a saved text input;
  expected `1,3|2|no|si` becomes `1,3|2|si|si`, and survives offline reopening.
  Existing source export, backup/restore and combat acceptance also passed.
- Initial new integration assertions incorrectly assumed that manual defaults
  with a null race produced empty derived collections. They failed on required
  original paths. The tests now explicitly require those failures; the evaluator
  was not weakened or supplied invented defaults.
- One intermediate TypeScript test assertion failed; replaced it with an actual
  array guard. All final checks above ran after the final application change.

At this earlier checkpoint, the requested views and `$view` edit sessions were
not yet implemented. The current scoped-view results above supersede that
limitation. Root-path browser and live provider checks were not rerun at this
earlier checkpoint. No dependencies, database schema or original source records
changed.

## Previous combat and deployment baseline

The following results predate the collection increment above.

| Check | Executed result |
| --- | --- |
| `node scripts/inspect-archer.mjs` | Passed; pinned gzip-JSON system extracted locally |
| `node scripts/package-fixtures.mjs` | Passed; both pinned original `.rpg` blobs exported locally |
| `npm run test:external` | Passed; two required historical-source integration tests |
| `npm run check` | Passed strict TypeScript and all 107 tests in eight files; external tests ran, none skipped |
| `npm run build` | Passed; production PWA, 11 precache entries, 613.40 KiB total precache |
| `PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/PolySheet/ npm run test:e2e -- --max-failures=1` | Passed all 30 tests under a Pages-style subdirectory, no skips, 53.5 seconds |
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
