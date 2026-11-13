# Compatibility, source audit, and first vertical slice

## Inspected sources

Documentation was read on 2026-11-13, starting from:

- [Introduction](https://docs.rpg-companion.app/)
- [System creation and composition rules](https://docs.rpg-companion.app/GettingStarted/SystemCreation)
- [Using the dev tool](https://docs.rpg-companion.app/GettingStarted/DeveloperTools/UsingTheDevTool)
- [RPGScript](https://docs.rpg-companion.app/GettingStarted/DeveloperTools/RPGScript)
- The individual type/formula/view pages linked in the matrix below.
- [Hosting systems](https://docs.rpg-companion.app/GettingStarted/HostingASystem)
  and [hosting resources](https://docs.rpg-companion.app/GettingStarted/HostingAResourceRepo).

The documentation site is live and does not expose a pinned release identifier
on these pages. Tests pin example content independently; do not assume future
documentation changes apply retroactively.

The actual repository, not just its README, was inspected at
[8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4):

```text
systems/5e/
systems/5e2024/
systems/pf2e/
systems/_stdlib/              # Shared RPGScript macros, not a game system
scripts/build_starter_bundle.py
scripts/check_compiler_parity.py
scripts/format_resource_instances.py
scripts/publish_release.py
scripts/validate_resource_instances.py
```

There is no root npm project or browser runtime in that repository. The root
`AGENTS.md`, `README.md`, and `LICENSE.md` were read. PF2e source-vs-output
resource-review delegation instructions are scoped to that work; no PF2e
resource import QA or resource content changes are performed here.

### Current source structure and tool reuse assessment

The three actual systems use `system/system.rpg.json` as root metadata and
split folders. For 5e, actual paths include:

```text
systems/5e/system/system.rpg.json
systems/5e/system/character_stats.rpgs
systems/5e/system/character_sheet_sections/06_abilities.rpgs
systems/5e/system/character_sheet_sections/02_notes.rpgs
systems/5e/system/character_creation_flow/01_item_1.rpgs
systems/5e/system/macros/system_common.rpgs
systems/5e/system/resources/note/index.rpg.json
systems/5e/system/resources/note/stats.rpgs
systems/5e/resource_instances/
```

The docs distinguish root resource **instances** from resource **definitions**
under `system/resources/`. Split composition is recursive, lexicographically
ordered, with documented deep merge, array concatenation, and selected ID merge.
SheetCore does **not** reconstruct this pipeline from filename guesses.

| Tool | Actual dependencies and behavior | Reuse decision |
| --- | --- | --- |
| `build_starter_bundle.py` | Python standard library, subprocess/filesystem, `dart`, external `~/Repositories/RPGCompanionApp/dev_tool/tool/refresh_system_builder.dart` | Not a compiler implementation; unavailable external dependency; build-time only |
| `publish_release.py` | Python, filesystem/subprocess, external Dart builder, AWS CLI for publishing | Not a client runtime; never executed; no publishing requested |
| `check_compiler_parity.py` | Python, Git worktrees/filesystem/subprocess, external platform-specific `refresh_system_builder` binary | Cannot replace missing compiler; build-time parity tooling only |
| `format_resource_instances.py` | Python `gzip/json/pathlib` and filesystem; formats existing instance files | Not a system parser or compiler; not copied |
| `validate_resource_instances.py` | Python standard library; regex extraction of base stat declarations and instance checks | Not a complete RPGScript parser or browser runtime; not copied |

The full compiler and its schema are not included in the inspected checkout.
The docs describe extension/desktop dev tools, but no verified browser compiler
or standalone decoder implementation was established. README calls tools MIT,
while `LICENSE.md` does not supply that grant. Because both dependencies and
licensing need further verification, **no external tool code is reused**.

## Format boundaries

| Kind | Input or internal data | Status |
| --- | --- | --- |
| A | One documented monolithic source JSON document | Partial, declared runtime subset |
| B | Split JSON/RPGScript authoring directory | Not supported; obtain composed JSON using verified official tooling |
| C | `.rpgs` authoring language, macros and imports | Not supported; no partial compiler |
| D | Compiled `.rpg` package | Only the verified gzip-JSON system envelope; unknown binary variants, indexes and resource archives rejected |
| E | SheetCore records and `sheetcore-backup` v3, legacy v1/v2 restore | Supported, internal only, not interchangeable with A–D |

Python scripts inspect some `.rpg` files as gzip JSON, while the public dev-tool
page calls `.rpg` binary. This is evidence about those specific tool paths, not
a universal package specification. SheetCore does not infer a general decoder.

### User-provided Archer distribution evidence

The additional supplied clone URL is
[`https://github.com/WaMXXVII/Archer-class.git`](https://github.com/WaMXXVII/Archer-class),
pinned to
[378bdf68f055bae8777a233fc0ac6e4f9eb6145c](https://github.com/WaMXXVII/Archer-class/tree/378bdf68f055bae8777a233fc0ac6e4f9eb6145c).
Its tracked tree contains only four compiled artifacts, with no source tree,
compiler, README, or license:

| Exact path | Compressed bytes | Observed payload | Scope |
| --- | ---: | --- | --- |
| `systems.rpg` | 101 | gzip → JSON root with `systems` | Distribution index, not an RPGSystem document |
| `5e/system.rpg` | 104105 | gzip → 1723608-byte JSON system, ID `5e`, version `0.9.1` | 317 stats, 50 resource definitions, 21 mechanics, six dice; partial runtime only |
| `5e/resources.rpg` | 169 | gzip → JSON root with `resources` | Resource distribution index, not system definitions |
| `5e/resources.rpg.gzip` | 6971 | gzip → custom-framed content beginning with an internal resource path, not a JSON document | Not decoded or imported as a resource pack |

`scripts/inspect-archer.mjs` reads only the pinned `5e/system.rpg` Git blob,
checks the observed gzip envelope, bounds the decoded output to 8 MiB, and
validates the expected system identity/count. It writes local-only
`.reference/archer-system.json`. It is optional inspection tooling. The browser
now directly decodes the same verified gzip-JSON system variant through native
`DecompressionStream`. Neither path defines a general `.rpg` decoder, composes
split sources, or compiles RPGScript.

Unlike the historical `0.5.1` source, this extracted `0.9.1` document has no
errors under the implemented field checks. Its serialization explicitly uses
`null` for optional `sub_value_type`, `resource_type`, `character_display_name`,
resource view fields and optional view conditions. These remain null in the
stored source. A null optional condition means absent, not a false formula.
Declared formula constants and numeric types still undergo normal validation.
Unsupported fields and contextual formulas remain diagnosed.

`tests/archer.test.tsx` verifies counts, dice, diagnostics, immutable installation,
manual defaults, the real strength modifier, saving and database reopening.
Desktop/mobile browser tests import the entire extracted document, require its
partial-support warning, edit the source abilities section (`8 → -1`, `15 → 2`),
and reopen offline. This does not establish Archer class/resource-instance
support. No content from this repository is distributed because no license was
found. See [NOTICE.md](../NOTICE.md).

### Reported derpsy repository and direct package verification

[derpsyhome/3rd-party-books-for-5e](https://github.com/derpsyhome/3rd-party-books-for-5e)
was inspected at
[00f55b2c3023c59f5857297dc933a7505c9b6aa4](https://github.com/derpsyhome/3rd-party-books-for-5e/tree/00f55b2c3023c59f5857297dc933a7505c9b6aa4).
The tracked tree lists the same index/system/resource-pack filenames, not a
JSON authoring tree. Its exact `5e/system.rpg` Git blob is 101867 bytes,
starts with gzip magic `1f8b0800`, and expands to 1690204 JSON bytes:
`5e` version `0.6.0`, 317 character stats and 50 resource definitions.
Its implemented-field diagnostics have no errors, but unsupported rules remain.

The browser adapter accepts gzip magic, bounds raw input and streamed expansion
independently to 8 MiB, requires valid UTF-8 and the existing monolithic schema,
then presents the same semantic diagnostics before confirmation. It does not
guess archive framing. `systems.rpg`, `resources.rpg`, resource archives,
truncated/checksum-corrupt gzip and unknown binary envelopes are rejected.
Exact uploaded bytes are hashed, stored and exported, including through backup
v3. JSON-only v1 and v2 backups and existing character pins remain compatible.

`tests/package.test.ts` checks both original pinned system blobs, source counts,
the unchanged strength formula, corruption, exact byte limits, source hashing,
binary round-trip, backup integrity and legacy restore. Browser tests upload
the actual files, edit abilities, reopen offline, download originals and restore
backups; exports must match the source bytes exactly. The direct pinned Raw URL
was additionally tested live in desktop and mobile Chromium, separately from
controlled HTTP fixtures. This establishes **system payload** import, not the
repository's book/class/race content or full rule execution.

## Why this slice

No system in the current checkout is a small self-contained JSON example.
The historical 5e and 5e2024 monolithic definitions both have 317 character stats,
46 resource definitions, 21 mechanics, and 16 sections. Neither warrants full
support in a first increment. 5e is selected as the deterministic tie-breaker,
not because of game popularity. Its six score/modifier pairs have a closed,
arithmetic dependency graph, and the abilities section directly names them.
The note resource adds a small independently testable text/conditional case.
PF2e's current RPGScript-driven creation, combat, progression, resource scopes
and macro compilation are unnecessary for that first closed graph.

The exact monolithic input comes from
[92b8128a1e6da7ed39406012e357d1e3d0e1792b](https://github.com/blastervla/rpg-companion-app-systems/tree/92b8128a1e6da7ed39406012e357d1e3d0e1792b),
`systems/5e/system.rpg.json`, version `0.5.1`. It requires **no compilation**.
Git history shows later split conversion (`f3952f908`) and later RPGScript stat
migration (`e6808322a`); those are different source variants, not interchangeable
input files.

### Full-system requirements, intentionally not claimed

The real file uses resource-valued stats, nested/nullable paths, contextual
variables, enumeration formulas, collections, roll events, creation effects,
mechanics, progression, rich views, and other unsupported formulas. Its creation
pages contain `post_edit`, `on_page_open`, and `on_page_close` hooks. Those hooks
are **not** run. Stat view `on_tap_event` requests `rollStat`; SheetCore does not
replace that mechanic with a guessed dice roll. The selected slice has no image
files or image URLs; the full definition includes a nullable `photo` stat.
Local photo editing/rendering is now supported under the limits below; remote
image fetching remains disabled.

## Contextual formulas and combat increment

The reported Archer `0.9.1` and derpsy `0.6.0` diagnostics led to an additional
verified subset. Source originals and existing character/version pins do not
change. `translatable` is recognized metadata; without a supplied translation
catalogue, the source name remains the fallback, not a fabricated translation.

| Feature | Verified behavior | Evidence |
| --- | --- | --- |
| `stat`, `defined`, `metaStat` | Dot/optional paths, nested local resources, declared presence, dynamic path; deprecated `for_resource` ignored; `ignore_cache` honored | Public formula docs, original contextual trees, `capabilities.test.ts` |
| `concat`, `date`, `created_at` | String/number concatenation and persisted timestamps; documented date shape, explicitly English/UTC | Real `created_at_display` returns `Created Jan 02, 2020` for the fixed test timestamp |
| `map`, `filter`, `defaultIfNull`, `joinToString` | Nested lexical bindings, strict boolean filtering, lazy null-only fallback, exact separator | Documentation examples and original character/combat trees |
| `max`, `min`, comparison/length/not/or, `trim`, `flatAppend` | Nonempty numeric extrema; strict scalar comparisons, pairwise `notEquals`, bounded flattening/set option | Documented examples and real `dice_roll.formula` |
| Photo and `avatar` | Local raster input/render/preview, inert remote URLs, source avatar name/photo fields | Source envelope, public avatar docs, typed browser acceptance |
| Typed base arrays/resources | Scalar list editor and explicitly internal same-version references; nested definitions evaluated | Integrity/backup tests and browser acceptance |
| `combat_system` | Source roster, difficulty, initialization, initiative, turns/passes/rounds, source resolution/XP summary | Real monster initialization produces HP 4 and XP pool 50 under deterministic dice |

The two pinned original systems pass the exact reported early-stat diagnostic
paths without suppressing warnings about unimplemented mechanics/views. Native
`dice_roll` base fields are used in tests, not a replacement constant `formula`.
Initialization overrides are stored separately and never rerun on read/restore.
See [combat usage and restrictions](COMBAT.md) for precise commands, contextual
scope, manual ties, date locale/timezone limits and unsupported lifecycle behavior.
This does not certify all dependencies of every character/resource formula.

## Explicit reduced external fixture

`externalSlice()` selects unchanged source objects:

- `character_stats[2]`: `name`.
- `character_stats[154..159]`: six `*_score` base stats, default `8`.
- `character_stats[160..165]`: six `*_modifier` calculated stats.
- `character_sheet_sections[5]`: `abilities`, including original header and events.
- `resources[39]`: `note`, including original stats and views.

Root ID/name are relabelled to `5e-sheetcore-slice` / `5e · verified ability slice`.
Unrelated character stats, sheet sections and resource definitions are removed.
Creation flow, mechanics, progression and enumerations are explicitly emptied;
indexed stats are reduced to `name`. Unknown root metadata and the original
search view remain and may produce warnings. This is **selection**, not source
compilation, a parser fix, a converted full system, or proof of full playability.

The original full document remains `.reference/5e.json`. The reduced local file
is `.reference/5e-slice.json`; its filename/source and renamed identity make the
reduction explicit. External tests assert equality of retained source objects.
Neither file ships with the application. See [NOTICE.md](../NOTICE.md).

## Documented/existing-format discrepancies

All paths below refer to the historical `systems/5e/system.rpg.json` unless noted.

| Path / field | Evidence | Handling |
| --- | --- | --- |
| `character_stats`, `resources`, `enumerated_types` | Type pages show Maps but expressly say to author Lists | Accept arrays, not invented map normalization |
| Root `type` | Type-page JSON illustration includes `RPGSystem`; actual example omits it | Optional envelope tag; original text retained |
| `party_visible`, calculated `default_value` | Current tables mark fields required, but documented examples and historical data omit them | Not required by this source variant |
| Root `dice` | Current RPGSystem table lists it; historical file omits it entirely | Warning; manual app roller is explicitly separate |
| Root `currencies` | Present historically, not part of the inspected RPGSystem table | Preserve and diagnose; do not invent semantics |
| Archer `0.9.1` optional fields | Serialized `null` for optional field types, display-name/view fields, and conditions | Preserve null; skip absent optional view conditions; tested separately |
| `character_stats[46].components.clauses[0].condition.components.components[1]` and analogous skill fields | `{value: 0, value_type: "string"}` | Type error, no implicit conversion |
| `character_stats[201].components.clauses[0].components.components.components[0]` and analogous fields | `{value: -8, value_type: "string"}` | Type error, not interpreted |
| `resources[2].stats[4].components.components.components[0].components.components[0].components.components[1].clauses[0].components` and following clauses | `{value: 2.5, value_type: "integer"}` | Type error; never silently rounded |
| `Views/text`, `Views/composite`, `Views/checkbox` live pages | Only common fields are shown; SystemCreation snippets and real files show additional fields | Only cross-checked fields are used; unsupported options remain diagnosed |
| Mechanic `event_names` | Table says List; prose/examples use comma-separated strings; RPGScript also documents resource scoping | All mechanics deferred; no guessed event dispatch |
| `divide.rounding_method = closest` | Enum lists value, no tie behavior supplied | Not supported; explicit diagnostic |
| README vs `LICENSE.md` | NC-SA vs NC and inconsistent tool-license statements | No external content/tool distribution; seek clarification before redistribution |

The complete historical file therefore fails interpreted-field validation.
The test suite asserts its errors. The reduced slice avoids the unrelated
defective objects without changing any retained formula's expected semantics.

## Compatibility matrix

“Supported” means tested for the stated subset, not all optional fields or all
upstream versions. Example pointers below are in
`systems/5e/system.rpg.json` at the pinned historical commit unless another
exact path is specified.

| Feature / documentation | Real example | Status and interpreter behavior | Associated test |
| --- | --- | --- | --- |
| [RPGSystem](https://docs.rpg-companion.app/System/RPGSystem), monolithic JSON | Root; `character_stats`, `resources` | Partial: original retained; required structural arrays, duplicate-ID/type/cycle diagnostics, unknown fields preserved | `import.test.ts`; `external.test.tsx` |
| [BaseStat](https://docs.rpg-companion.app/Stat/BaseStat) | `character_stats[2]`, `[154..159]` | Scalars, declared scalar/resource arrays, local references and photos; clone defaults and patch base fields; no general modifier engine | engine, persistence, capabilities, external |
| [ComputedStat](https://docs.rpg-companion.app/Stat/ComputedStat) | `character_stats[160..165]` | Partial: explicit snapshot, dependency memoization, missing refs/cycles, finite/type checks, 10k-step/64-depth budget | engine + external |
| [constant](https://docs.rpg-companion.app/Stat/Formulas/constant) | `character_stats[160].components.components.components[1]` | Partial: type-checked scalars and scalar lists; no coercion or arbitrary JS | engine + import + external |
| [stat](https://docs.rpg-companion.app/Stat/Formulas/stat) | `character_stats[160].components.components.components[0].components.components[0]` | Direct and safe nested/optional paths; explicit resource/lambda/combat scopes only; missing required contexts fail | engine + capabilities + external |
| [list](https://docs.rpg-companion.app/Stat/Formulas/list), [add](https://docs.rpg-companion.app/Stat/Formulas/add) | `character_stats[160].components.components`, nested `add` | Supported numeric subset; list node evaluates its child formulas; add consumes its result | engine + external |
| [subtract](https://docs.rpg-companion.app/Stat/Formulas/subtract), [multiply](https://docs.rpg-companion.app/Stat/Formulas/multiply) | `character_stats[207].components` (subtract), `character_stats[14].components.components.components[1]` (multiply) | Numeric-only ordered operands; mixed-type coercion rejected. `max/map` are supported, but empty lists and unsupported downstream resource dependencies still fail explicitly | engine + capabilities |
| [divide](https://docs.rpg-companion.app/Stat/Formulas/divide) | `character_stats[160].components` | Partial: ordered division; explicit down/up/none; reject zero, missing rounding, closest | engine, documented `[20,2,5] = 2`, external `8 → -1`, `15 → 2`, `9 → -1` |
| [when](https://docs.rpg-companion.app/Stat/Formulas/when), [isEmpty](https://docs.rpg-companion.app/Stat/Formulas/isEmpty) | `resources[39].stats[2].components` | Supported subset: first matching bool condition only; isEmpty accepts text/list | engine + external note default/title tests |
| [and](https://docs.rpg-companion.app/Stat/Formulas/and) | `resources[39].edit_view.subviews[0].validation_message.clauses[0].condition` | Partial: boolean-list formula supported without short circuit; `$view` validation scope itself unsupported | engine verifies all operands evaluated |
| [CharacterSheetSection](https://docs.rpg-companion.app/System/CharacterSheetSection), [section](https://docs.rpg-companion.app/Views/section) | `character_sheet_sections[5]` | Partial: source order, header/content, collapsibility and responsive minimum width; no lifecycle actions | renderer + external + E2E |
| [stat view](https://docs.rpg-companion.app/Views/stat) | `character_sheet_sections[5].view.content[0..5]` | Partial: displayed stat and distinct edit_stat, names, signs, scalar editing; events not executed and visibly flagged | renderer + external + offline external E2E |
| [text](https://docs.rpg-companion.app/Views/text) | `character_sheet_sections[5].view.header[1]`, `resources[39].display_view.subviews[0]` | Partial: plain text, supported styles/labels/hints/scalar editing; no rich content, view-scoped validation or resource linking | renderer + source equality tests |
| [list](https://docs.rpg-companion.app/Views/list), [composite](https://docs.rpg-companion.app/Views/composite), [checkbox](https://docs.rpg-companion.app/Views/checkbox) | `resources[39].display_view` (list), `character_search_item_view` (composite), `character_sheet_sections[2].view.header[3].pop_up_view.content[0]` (checkbox) | Partial: source child order and supported layout fields; bool base stat editing; complex options diagnosed. The surrounding popup/avatar views are not supported | renderer tests; original fixture E2E |
| Unknown/interactive/resource views | `character_sheet_sections[5].view.header[0]` (`icon`), notes/resource views elsewhere | Not supported unless registered; visible fallback, no invented button actions | renderer + external |
| [Resource](https://docs.rpg-companion.app/System/Resource) | `resources[39]` | Definitions, typed manual base editing and safe display view; notebook links distinct from typed references; no general effects or RPG resource export/import | persistence + capabilities + E2E |
| [CharacterCreationPage](https://docs.rpg-companion.app/System/CharacterCreationPage) | `character_creation_flow[0..3]`; current `systems/5e/system/character_creation_flow/01_item_1.rpgs` | Not supported; explicit separate manual creator | import diagnostics + browser manual-creation assertion |
| [Mechanic](https://docs.rpg-companion.app/Mechanic/), [Effect](https://docs.rpg-companion.app/Effects/Effect) | `mechanics[]`; stat-view `on_tap_event` | General dispatch/stacking/reversal unsupported. Only explicit combat instance `on_create` synchronous sequence and one `setStat/set` per direct target execute atomically | import + renderer + combat tests |
| [RPGDice](https://docs.rpg-companion.app/System/RPGDice), [Rollable](https://docs.rpg-companion.app/System/Rollable) | Historical root has no `dice`; supplied Archer `5e/system.rpg` decoded JSON `dice[0..5]` defines d4/d6/d8/d10/d12/d20 | Partial: imported face definitions, `xdy +/- n` manual roller and history; no Rollable object/effect dispatch or 3D | engine dice tests, Archer integration + E2E; historical absence warning |
| [Split composition](https://docs.rpg-companion.app/GettingStarted/SystemCreation) | Current `systems/5e/system/` | Not supported; no folder/archive import or guessed merge | file format rejection |
| [RPGScript/dev tool](https://docs.rpg-companion.app/GettingStarted/DeveloperTools/RPGScript) | Current `systems/5e/system/character_stats.rpgs` and `_stdlib/*.rpgs` | Not supported in browser; no partial compiler, external tool code not reused | documented input restriction |
| Distribution and `.rpg` | Supplied Archer and derpsy `5e/system.rpg` pinned blobs | Partial: native gzip-JSON **system** decoding only; exact original-file hash/export; 8 MiB raw/expanded limits. No repository crawling, resource-pack import, guessed framing or generic binary support | package regressions, both real files, offline/backup E2E and separate live Raw URL check |
| Internal local storage and backup | No upstream example: deliberately SheetCore-specific | IndexedDB schema v3, backup v3 with gzip originals/encounters, legacy v1/v2 restore, atomic validated replacement, offline shell/content | persistence/migration/package/capabilities + desktop/mobile E2E |

## Verification and extension gates

The real integration path is:

```text
pinned real Git blob
→ full structural/semantic diagnostics (including expected source type errors)
→ explicitly selected, unchanged source objects
→ JSON import preview and installation
→ manual character defaults
→ source abilities section
→ edit source score
→ independently expected modifier
→ IndexedDB save/reopen and backup round-trip
→ production browser offline reopen
```

No test infers success from JSON parsing alone. Each supported ability modifier
starts at `-1` for score `8`; score `15` produces `2`; score `9` produces `-1`.
Note display title starts as `Untitled note` and becomes the supplied title.
The original distributed example independently expects Slancio `3 → 8` when
Vigore changes `2 → 7`.

The Archer artifact provides an additional verified composed JSON variant,
not the missing compiler or full rule semantics. To extend beyond these paths,
obtain the required verified artifacts/tooling, resolve applicable licenses,
and establish the missing event/scope/override semantics with expected outputs.
Do not mark 5e, 5e2024, or PF2e as fully supported based on these tests.

Formula and view handlers have explicit registries. An effect registry/event
dispatcher is intentionally deferred beyond the bounded combat initializer;
adding an empty registry would not establish general ordering, reversal or
stacking semantics. No effects are silently treated as successful no-ops.

Executed checks and remaining verification gaps are in
[VERIFICATION.md](VERIFICATION.md).
