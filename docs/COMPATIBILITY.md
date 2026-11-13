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
PolySheet does **not** reconstruct this pipeline from filename guesses.

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

Public GitHub root/`.git` links now support bounded file discovery and explicit
selection at an immutable commit. This retrieves existing system distributions;
it does not change any format or runtime-rule support below. See the
[provider contract and limits](GITHUB_IMPORT.md). Public REST commit/tree
documentation was inspected on 2026-11-13; real-source checks use pinned derpsy
`00f55b2c3023c59f5857297dc933a7505c9b6aa4`, path `5e/system.rpg`.

| Kind | Input or internal data | Status |
| --- | --- | --- |
| A | One documented monolithic source JSON document | Partial, declared runtime subset |
| B | Split JSON/RPGScript authoring directory | Not supported; obtain composed JSON using verified official tooling |
| C | `.rpgs` authoring language, macros and imports | Not supported; no partial compiler |
| D | Compiled `.rpg` package | Only the verified gzip-JSON system envelope; unknown binary variants, indexes and resource archives rejected |
| E | PolySheet records and `polysheet-backup` v3, legacy v1/v2 restore | Supported, internal only, not interchangeable with A–D |

Python scripts inspect some `.rpg` files as gzip JSON, while the public dev-tool
page calls `.rpg` binary. This is evidence about those specific tool paths, not
a universal package specification. PolySheet does not infer a general decoder.

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
are **not** run. Stat view `on_tap_event` requests `rollStat`; PolySheet does not
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

## Additional collection formula increment

The six additional formula handlers follow the public
[`sortBy`](https://docs.rpg-companion.app/Stat/Formulas/sortBy),
[`isNull`](https://docs.rpg-companion.app/Stat/Formulas/isNull),
[`contains`](https://docs.rpg-companion.app/Stat/Formulas/contains),
[`findFirst`](https://docs.rpg-companion.app/Stat/Formulas/findFirst),
[`flatMap`](https://docs.rpg-companion.app/Stat/Formulas/flatMap) and
[`toLowerCase`](https://docs.rpg-companion.app/Stat/Formulas/toLowerCase) pages,
read on 2026-11-13. Pinned derpsy `00f55b2` / `5e/system.rpg` version `0.6.0`
provides unchanged examples at decoded JSON paths:

| Path | Contract and independently expected result |
| --- | --- |
| `character_stats[33].components`, `[171].components` | `sortBy`: stable, nonmutating ordering; explicit asc/desc; homogeneous string or finite numeric selector results; `$sortByValue` or custom lexical key. Numeric `[3,1,2,1]` sorts to `[1,1,2,3]`. Text uses ordinal comparison, not browser locale. |
| `character_stats[36].components` | `isNull`: null only; zero, false and empty string are not null. |
| `character_stats[144].components` | `contains`: case-sensitive substring or strict list membership, including internal resource-reference identity; no text/number coercion. |
| `character_stats[148].components`, `[208].components` | `findFirst`: optional strict-boolean filter, default `$findFirstValue`, first matching item. No match returns null, consistent with the original nullable equipped-armor use; the public prose does not explicitly specify the no-match result. |
| `character_stats[167].components.components[1]` | `flatMap`: mapper arrays flattened one level; custom `$class` binding; lexical outer bindings preserved; output limited to 10,000 items. Empty classes produce an empty array. |
| `character_stats[291].components`, `[313].components` | `toLowerCase`: strings only, Unicode lowercase, no coercion. |

Local resource paths expose the instance's internal `id` when no stat declares
that name. This implements the original `[148]` predicate
`$findFirstValue.id == equipped_armor_id`: selecting the second of two local
armor references returns that exact reference, not a definition ID or array index.
This does not implement upstream resource-pack imports.

`tests/collections.test.ts` covers these contracts, malformed operands, nested
bindings, failed-scope cleanup, output/operation bounds, full diagnostic arrays,
and both pinned source variants. The original manual defaults have no race:
required `race.traits`, `race.weapons` and `race.current_level_traits` paths
still fail visibly. No empty list is substituted to make these formulas pass.
These formula checks preceded the scoped-view increment below.

## Scoped view increment and source evidence

The public [RPGView contract](https://docs.rpg-companion.app/Views/RPGView)
requires actual input drafts and null validation messages before Save. That
contract now has a scoped implementation, not an empty `$view` registration.
The following decoded paths are from derpsy `00f55b2` / `5e/system.rpg` `0.6.0`;
the corresponding Archer `378bdf6` / `0.9.1` paths are tested separately.

| Original path | Implemented contract and independent expected result |
| --- | --- |
| `character_sheet_sections[0].view` | [avatarSection](https://docs.rpg-companion.app/Views/avatarSection): center content and corner stacks; unsupported menu/event behavior remains visible |
| `character_sheet_sections[1].view.header[0]` | [icon](https://docs.rpg-companion.app/Views/icon): source `ic_notes` maps to a local glyph, with size/color; not original artwork |
| `character_sheet_sections[1].view.header[3]` | [selectResources](https://docs.rpg-companion.app/Views/selectResources): create a `note` through its actual edit view, append to `notes`, atomically persist both records; empty title and text reject Save |
| `character_sheet_sections[1].view.content[0]` | [resourceSection](https://docs.rpg-companion.app/Views/resourceSection): original note list/display/edit views; unlink removes only the owner reference |
| `character_sheet_sections[2].view.header[3]` | [popUpButton](https://docs.rpg-companion.app/Views/popUpButton): stage condition booleans; Cancel/reopen retains false, Save persists true; source `should_persist_on_save=true` |
| `character_sheet_sections[2].view.content[0]` | [chip](https://docs.rpg-companion.app/Views/chip): `blinded` controls visibility, safe palette/style; `remove_condition` remains unexecuted and diagnosed |
| `character_creation_flow[0].view.subviews[10].content[0..5]`, `character_stats[201..206]` | Real input-ID `$view` values drive each unchanged point-buy formula. For every ability, 8 → 0, 13 → 5, 14 → 7, 15 → 9. Editing strength in the manual group shows cost 7 before Save at score 14. |
| `resources` entry `id=note`, `edit_view.subviews[0].validation_message` | Source null/string validation; text updates scope before blur; failed Save leaves inputs intact |
| Reported text/section fields | Numeric signs, visual line clamp, color/typed resource-ID display; section collapse icon defaults false (collapsed-only), true keeps it visible |

The manual creation-field editor retains each selected input object but uses an
explicit local wrapper, not the original creation page. It does not run the
group's `$is_new`/generation-mode visibility condition or lifecycle hooks.
Individual input conditions, source bounds and validation remain active.
It therefore establishes real scoped formulas, **not** official point-buy mode
selection, complete creation validation or budget enforcement.

Diagnostics now inspect nested popup/icon/avatar-stack/header views and all
creation-page view trees, not only the first 100 UI entries. Unknown events,
dynamic chip factories, unsupported menu/select controls, lifecycle and filter
behavior remain diagnosed. Known enum variants have behavioral checks; unknown
variants are not silently rendered as defaults.

See [the precise supported options and remaining limits](VIEWS.md).

## Container, selector and counter view increment

The same derpsy `5e` `0.6.0` document supplies these decoded paths. Semantics
come from the public per-view pages and their enumerated-type pages; any
uncertainty is resolved conservatively and stays visible.

| Original path | Implemented contract and independent expected result |
| --- | --- |
| `character_sheet_sections[9].view.content[0]` (`class_features_subsection`) | [resourceArray](https://docs.rpg-companion.app/Views/resourceArray): display the referenced class instances with their own display view and hidden content line; no create control in `display` mode |
| `character_creation_flow[0].view.subviews[3]` (classes editor) | `edit` mode lists the referenced instances, offers create/remove and keeps the source validation formula active through the real draft session |
| `character_creation_flow[0].view.subviews[2].subviews[2]` (`edit_character_basics_subrace_select`) | [select](https://docs.rpg-companion.app/Views/select): local `resource_options` with `options_display_stat` `name`; one stored id per single select |
| `character_creation_flow[0].view.subviews[4].subviews[1]` (`edit_character_basics_hit_point_mode_select`) | [select](https://docs.rpg-companion.app/Views/select): enumerated `options` (`hit_point_modes`) with inherited entries and `allowed_options`; the chosen entry id is stored |
| `character_creation_flow[0].view.subviews[2].subviews[0].pop_up_view` (`edit_character_basics_see_race_bottom_sheet`) | [resource](https://docs.rpg-companion.app/Views/resource): render the referenced race through its declared display view; `create_if_empty` is reported, not executed |
| `character_sheet_sections[4].view.header[1]` (`status_hp`) | [ticker](https://docs.rpg-companion.app/Views/ticker): `plusMinus` buttons change the base `current_hp`, clamped at `min_value_allowed` 0; a direct edit below that minimum shows an error and saves nothing |
| `character_sheet_sections[0].view.bottom_right_stack[0]` (`lifecycle_events_button`) | [menuButton](https://docs.rpg-companion.app/Views/menuButton): icon and enumeration entries render; choosing one shows the unexecuted event instead of inventing an action |
| `resources[1].display_view.subviews[6]` (`armor_display_effects_collapsible`) | [collapsible](https://docs.rpg-companion.app/Views/collapsible): source title/subtitle, start-expanded state and nested content; visibility uses the real source formula |
| `resources[3].edit_view`, `resources[4].edit_view`, `resources[27].edit_view` | [viewPager](https://docs.rpg-companion.app/Views/viewPager): one page at a time with the source page names and constant color |
| `resources[1].display_view.subviews[7].subviews[0]` (`armor_display_attune_button`) | [button](https://docs.rpg-companion.app/Views/button): source text renders; the declared `event` is never executed and the control stays disabled with a visible note |

`ticker` visibility formulas that reference `$edit_mode` resolve to `true` only
inside a real draft session. A plain sheet keeps them hidden instead of exposing
an editor that would persist immediately. `button`/`menuButton` events, filter
maps, `create_if_empty` and the `diffText` view remain unsupported and diagnosed;
no source event is treated as a successful no-op.

## Explicit reduced external fixture

`externalSlice()` selects unchanged source objects:

- `character_stats[2]`: `name`.
- `character_stats[154..159]`: six `*_score` base stats, default `8`.
- `character_stats[160..165]`: six `*_modifier` calculated stats.
- `character_sheet_sections[5]`: `abilities`, including original header and events.
- `resources[39]`: `note`, including original stats and views.

Root ID/name are relabelled to `5e-polysheet-slice` / `5e · verified ability slice`.
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
| [and](https://docs.rpg-companion.app/Stat/Formulas/and) | `resources[39].edit_view.subviews[0].validation_message.clauses[0].condition` | Boolean-list formula without short circuit; real scoped form validation | engine + view-session + browser |
| [CharacterSheetSection](https://docs.rpg-companion.app/System/CharacterSheetSection), [section](https://docs.rpg-companion.app/Views/section) | `character_sheet_sections[5]` | Partial: source order, header/content, collapsibility and responsive minimum width; no lifecycle actions | renderer + external + E2E |
| [stat view](https://docs.rpg-companion.app/Views/stat) | `character_sheet_sections[5].view.content[0..5]` | Partial: displayed stat and distinct edit_stat, names, signs, scalar editing; events not executed and visibly flagged | renderer + external + offline external E2E |
| [text](https://docs.rpg-companion.app/Views/text) | `character_sheet_sections[5].view.header[1]`, `resources[39].display_view.subviews[0]` | Plain text/scalar editing, scoped validation, signs/clamp/colors and pinned local resource-ID display; no HTML/Markdown | renderer + view-session + browser |
| [list](https://docs.rpg-companion.app/Views/list), [composite](https://docs.rpg-companion.app/Views/composite), [checkbox](https://docs.rpg-companion.app/Views/checkbox) | `resources[39].display_view` (list), `character_search_item_view` (composite), `character_sheet_sections[2].view.header[3].pop_up_view.content[0]` (checkbox) | Source order/layout/padding, scalar checkbox drafts and original popup Save/Cancel; unsupported options remain diagnosed | renderer + view-session + original browser acceptance |
| Interactive/resource views | Original notes, condition popup/chips, avatar and section icons | Registered subset above and in VIEWS.md; unknown types/events still have visible fallbacks, not invented actions | renderer + view-session + original browser acceptance |
| [collapsible](https://docs.rpg-companion.app/Views/collapsible), [viewPager](https://docs.rpg-companion.app/Views/viewPager), [ticker](https://docs.rpg-companion.app/Views/ticker), [button](https://docs.rpg-companion.app/Views/button), [select](https://docs.rpg-companion.app/Views/select), [menuButton](https://docs.rpg-companion.app/Views/menuButton), [resource](https://docs.rpg-companion.app/Views/resource), [resourceArray](https://docs.rpg-companion.app/Views/resourceArray) | `character_sheet_sections[9].view.content[0]`, `resources[3].edit_view`, `character_sheet_sections[4].view.header[1]`, `resources[1].display_view.subviews[7].subviews[0]`, `character_creation_flow[0].view.subviews[4].subviews[1]`, `character_sheet_sections[0].view.bottom_right_stack[0]`, `character_creation_flow[0].view.subviews[2].subviews[0].pop_up_view`, `character_creation_flow[0].view.subviews[3]` | Tested subset: accordion/pager state, bounded ticker edits, enumeration and local-resource options, resource display/edit/list and array create/remove. Button and menu events, `create_if_empty`, filter maps and `diffText` stay unsupported and diagnosed | `source-views.test.tsx` + renderer + view-session |
| [Resource](https://docs.rpg-companion.app/System/Resource) | `resources[39]` | Definitions, typed manual base editing and safe display view; notebook links distinct from typed references; no general effects or RPG resource export/import | persistence + capabilities + E2E |
| [CharacterCreationPage](https://docs.rpg-companion.app/System/CharacterCreationPage) | `character_creation_flow[0..3]`; current `systems/5e/system/character_creation_flow/01_item_1.rpgs` | Not supported; explicit separate manual creator | import diagnostics + browser manual-creation assertion |
| [Mechanic](https://docs.rpg-companion.app/Mechanic/), [Effect](https://docs.rpg-companion.app/Effects/Effect) | `mechanics[]`; stat-view `on_tap_event` | General dispatch/stacking/reversal unsupported. Only explicit combat instance `on_create` synchronous sequence and one `setStat/set` per direct target execute atomically | import + renderer + combat tests |
| [RPGDice](https://docs.rpg-companion.app/System/RPGDice), [Rollable](https://docs.rpg-companion.app/System/Rollable) | Historical root has no `dice`; supplied Archer `5e/system.rpg` decoded JSON `dice[0..5]` defines d4/d6/d8/d10/d12/d20 | Partial: imported face definitions, `xdy +/- n` manual roller and history; no Rollable object/effect dispatch or 3D | engine dice tests, Archer integration + E2E; historical absence warning |
| [Split composition](https://docs.rpg-companion.app/GettingStarted/SystemCreation) | Current `systems/5e/system/` | Not supported; no folder/archive import or guessed merge | file format rejection |
| [RPGScript/dev tool](https://docs.rpg-companion.app/GettingStarted/DeveloperTools/RPGScript) | Current `systems/5e/system/character_stats.rpgs` and `_stdlib/*.rpgs` | Not supported in browser; no partial compiler, external tool code not reused | documented input restriction |
| Distribution and `.rpg` | Supplied Archer and derpsy `5e/system.rpg` pinned blobs | Partial: native gzip-JSON **system** decoding only; exact original-file hash/export; 8 MiB raw/expanded limits. No repository crawling, resource-pack import, guessed framing or generic binary support | package regressions, both real files, offline/backup E2E and separate live Raw URL check |
| Internal local storage and backup | No upstream example: deliberately PolySheet-specific | IndexedDB schema v3, backup v3 with gzip originals/encounters, legacy v1/v2 restore, atomic validated replacement, offline shell/content | persistence/migration/package/capabilities + desktop/mobile E2E |

## Reported empty-class HP failure

The user-supplied `system.rpg` declares system `5e`, version `0.6.0`, with
exact-upload SHA-256
`629daf13b73eb11fc898077418ee2440ccdc75c12e59720c074780cb99e1ed9c`.
Its upstream revision was not independently established; version equality alone
does not identify a pinned repository blob.

Manual defaults set `classes` to `[]` (`$.character_stats[29]`) and `base_hp`
to 1 (`$.character_stats[10]`). The original `level` formula
(`$.character_stats[143]`) sums class levels, producing 0 for this state.
`classes_hp_mods` (`$.character_stats[14]`) contains an inner `max(map(classes))`
at `$.character_stats[14].components.components.components[1].components.components[1]`.
With no classes, that inner maximum receives `[]`. Its enclosing `max(0, ...)`
cannot protect it because evaluating the second operand already fails.
`max_hp` (`$.character_stats[12]`) propagates the error.

The public [max contract](https://docs.rpg-companion.app/Stat/Formulas/max)
explicitly requires a nonempty numeric list. The independently expected result
is therefore an evaluation failure, not 0 or the base HP. This was reproduced
against the exact uploaded file with original manual defaults, including repeated
reads and unchanged inputs. No source or evaluator fallback was added.

This is a limitation of opening an incomplete manual character, not a repaired
character-creation workflow. The initial diagnosis did not verify populated
classes. The follow-up below verifies one explicit manual path; selecting a
class is not a guarantee that all downstream formulas are supported.

### Manual class completion and `notNull`

The same exact-upload fixture is retained locally as
`.reference/reported-system.rpg`; no upstream revision is inferred.
Its `$.resources[4]` (`class`) source edit form contains duplicate
`class_edit_base_ac` view IDs, so the scoped form cannot safely open.
An explicit manual base-field editor must remain available without claiming to
execute that invalid source form or its validation/events.

Completing the class references also reaches
`$.resources[4].stats[5].components.clauses[0].condition.components.components[0]`
(`actual_hp_modifiers`), which uses
[`notNull`](https://docs.rpg-companion.app/Stat/Formulas/notNull).
The public contract defines this as exactly `not(isNull(value))`: only null
returns false; 0, false, empty text and an empty array return true. Missing
operands and unsupported nested formulas must still fail.

Independent expected values for a manually entered class with the source
default `hp_modifiers=["constitution"]`, no archetypes, class level 2,
character Constitution 14 and base HP 10 are: level 2, Constitution modifier 2,
class HP modifier 4 and maximum HP 14. No class content, die roll or HP
progression is inferred. This does not establish general creation compatibility.

`tests/resource-editor.test.tsx` verifies the unmodified original formulas,
manual resource controls, local error isolation and recovery. The production
Playwright case additionally verifies actual `Classes` assignment, maximum HP
14, offline reopening, backup replacement and retained original compressed
bytes on desktop/mobile. These cases skip explicitly without the local fixture.
Independent MIT regressions always run for `notNull`, child-render recovery,
cancelled drafts, failed-reference rollback and concurrent resource edits.

The formula evaluator and import validator now implement `notNull`. The
nonempty `max` contract is unchanged. View errors, including errors thrown by
deferred React children such as `ticker`, stay visible inside a local boundary
instead of taking down the app shell. Manual resource editing is explicitly
available when the original form fails; source form validation is not bypassed
silently or advertised as supported.

### Reported AC, description and avatar menu diagnostics

The same exact-upload fixture reproduces
`armor_class: classes_ac: max richiede una lista non vuota` with `classes=[]`.
`$.character_stats[146].components` takes the maximum of class AC values;
`$.character_stats[144]` consumes it. No fallback for an empty maximum is
introduced. The description at `$.character_stats[28].components` ultimately
requires `race.name`; the default `race=null` at `[31]` cannot supply it.

With explicit local class, class-details and race records, class level 2,
Dexterity 14, default source base AC 10 and AC modifier `dexterity`, both
`classes_ac` and `race_ac` independently equal 12, so `armor_class` equals 12
without equipped armor or a shield. Manually naming the records `Manual class`
and `Manual race` yields description `Manual race Manual class 2`. Unit and
desktop/mobile production tests exercise this recovery without changing source
formulas. Browser tests retain AC and description offline and after backup
replacement, alongside the previously verified HP 14.

The original avatar menu at
`$.character_sheet_sections[0].view.bottom_right_stack[0]` already renders
`lifecycle_events_menu` in the current renderer. The original status section's
`$edit_mode` conditions also resolve without a missing-stat error. These two
reported errors were not reproduced on the current code. Selecting `Long rest`
still reports an unexecuted event, not a completed rest.

The original serialized `bottom_right_button_event=null` no longer creates a
runtime unsupported-field note. Null-valued optional view fields are absent for
that runtime note only; stored source and conservative import diagnostics remain
unchanged. The non-null `bottom_left_button_event` (`show_information`) remains
visibly unsupported. On mobile, the right-corner menu previously extended beyond
the viewport and could not be selected by pointer. It now aligns its right edge
with its trigger. An always-on original MIT browser regression checks bounds and
pointer selection on desktop/mobile, independently of the external fixture.

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
