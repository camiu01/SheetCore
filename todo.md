# System compatibility TODO

Scope: full runtime support for the inspected `5e` version `0.6.0` system,
not universal RPG-system compatibility. Updated 2026-11-13.

The supplied `system.rpg` matches the pinned derpsy distribution: 101867
compressed bytes, 317 character stats and 50 resource definitions. SHA-256:
`629daf13b73eb11fc898077418ee2440ccdc75c12e59720c074780cb99e1ed9c`.
The current diagnostic snapshot contains 1,875 warnings, many repeated or about
null optional fields. This is not a count of distinct missing features.

Existing collection formulas, scoped drafts, supported source popups, atomic
saves and combat initialization are not listed as missing. Their limits remain
documented in [VIEWS](docs/VIEWS.md) and [COMPATIBILITY](docs/COMPATIBILITY.md).
Public GitHub root/`.git` retrieval is implemented separately; it does not
complete external content-archive support. See [GitHub import](docs/GITHUB_IMPORT.md).

## 1. Contexts, references and incomplete characters

- [ ] Implement real `$character`, `$parent`, `$edit_mode` and `$is_new` scopes
  with verified ownership, nesting, cache isolation and lifecycle semantics.
- [ ] Support required nested resource read/write paths, preserving exact
  system pins and patching the latest owner atomically.
- [ ] Resolve the empty-class saving-throw failure: `classes=[]` currently
  produces null proficiency, which fails the strict boolean `when` condition.
- [ ] Handle unselected race/class states through verified source behavior and
  creation flow. Reproduce `race.current_level_traits` and `race.name` failures;
  do not fabricate an empty race or coerce null conditions to false.

## 2. Remaining formulas and resource operations

- [ ] Verify and implement `notNull`, `enumeratedName`,
  `enumeratedAbbreviation` and `eventName`.
- [ ] Verify and implement `toNum`, `toSignedString`, `replace`, `split`
  and `append`, including invalid inputs and bounds.
- [ ] Verify and implement `copyResource`, including identity, references and
  clone ownership; do not assume shallow or deep copying semantics.
- [ ] Implement `createChip` and dynamic `listItem.chips` evaluation/rendering.

## 3. Missing source views and controls

- [ ] Implement `resourceArray`, including `class_features_subsection` and
  the validated operands editor `value_calculator_edit`.
- [ ] Implement `resource` and enumerated `select` controls.
- [ ] Implement `menuButton`, including `skills_section_menu`,
  `lifecycle_events_button`, allowed options and real action dispatch.
- [ ] Implement `viewPager`, `ticker`, `collapsible`, `button` and `diffText`.
- [ ] Implement dynamic stat bounds: `calculated_min_value_allowed` and
  `calculated_max_value_allowed`.
- [ ] Implement stat interactions: `on_tap_event` and `on_long_tap_event`.
- [ ] Implement stat sheets: `bottom_sheet_view`, `bottom_sheet_in_edit_mode`,
  `sheet_title` and `edit_bottom_sheet_title`.
- [ ] Implement `stat_color` and `name_color` using safe source color handling.
- [ ] Complete checkbox `switcher` and `should_auto_save`, vertical dividers,
  selection `filters`, resource `search_filters` and `sort_options`.
- [ ] Verify and implement remaining popup options: `extra_buttons`,
  `in_edit_mode` and `dismissible`.
- [ ] Verify the behavior of resource metadata `is_encounter_template` and
  `is_combatant_entry` before treating those fields as supported.

## 4. General events, effects and mechanics

- [ ] Establish event scopes, execution order, aggregation, reversal and
  failure semantics from upstream documentation and pinned examples.
- [ ] Implement the general effect pipeline, including iteration, stat changes,
  event forwarding, delayed effects, messages and resource/popup actions.
  Existing combat initialization supports only its documented subset.
- [ ] Execute and verify all 21 system mechanics and the resource mechanics,
  including rests, daily events, condition removal, proficiency changes and
  source-defined stat rolls.
- [ ] Keep commands bounded and atomic. Never trigger events, initialization
  or rolls during rendering, reopening or backup restoration.

## 5. Official character creation and progression

- [ ] Execute original creation pages, navigation, conditions and validations.
- [ ] Implement `on_page_open`, `on_page_close` and `post_edit` with verified
  draft, confirmation, cancellation and repeated-operation behavior.
- [ ] Integrate race, class, background, abilities and related resource choices
  through the actual source workflow, not a replacement ruleset.
- [ ] Implement `experience_levelling_system` and `point_progression_system`,
  including confirmation, resource assignment and level-dependent effects.
- [ ] Retain the explicit distinction between manual source-input groups and
  the official creation/progression workflow until this section is complete.

## 6. External content archives, separate from system import

- [ ] Verify archive framing, upstream tooling and redistribution rights before
  implementing external resource-pack import.
- [ ] Import and validate actual race, class, item and spell instances with
  correct definition/version references, duplicate handling and source provenance.
- [ ] Connect imported content to selection/search without confusing system
  definitions, distribution indexes, content archives and internal backups.

This section is needed to use external compendia. Successful `system.rpg`
import alone neither imports those contents nor establishes archive support.

## 7. Evidence and completion gates

- [ ] For each feature, record upstream semantics, pinned source paths,
  uncertainties and independently expected results in `docs/COMPATIBILITY.md`.
- [ ] Add regression tests on the original system, including null/empty states,
  nested scopes, cancellation, repeated actions, concurrent edits and rollback.
- [ ] Compare complete character workflows with verified upstream behavior:
  creation, leveling, equipment, spells, rests and combat.
- [ ] Exercise desktop/mobile controls, offline reopening, exact original export
  and backup restoration without changing imported originals or character pins.
- [ ] Run `npm run check`, `npm run build`, `npm audit --omit=dev` and production
  Playwright on isolated port 4183 as required by `AGENTS.md`.
- [ ] Inspect the complete diagnostics, not only the first 100 displayed items.
  Resolve each relevant unsupported path through implementation and evidence,
  never warning suppression or acceptance-only registry changes.
- [ ] Update `docs/VERIFICATION.md` with actual results and remaining limits.
  Zero static errors or passing import tests alone do not prove compatibility.
