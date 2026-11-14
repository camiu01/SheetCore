# System compatibility TODO

Scope: full runtime support for the inspected `5e` version `0.6.0` system,
not universal RPG-system compatibility. Updated 2026-11-14.

The supplied `system.rpg` matches the pinned derpsy distribution: 101867
compressed bytes, 317 character stats and 50 resource definitions. SHA-256:
`629daf13b73eb11fc898077418ee2440ccdc75c12e59720c074780cb99e1ed9c`.
The current diagnostic snapshot contains 1,601 warnings, many repeated or about
null optional fields. This is not a count of distinct missing features.
Measured on 2026-11-14 after the enumeration/string formula increment: 0 errors,
1,601 warnings — 1,421 uninterpreted fields, 0 unsupported view instances, 3
unsupported formula nodes of 11,792, 129 unresolved formula references, 21
mechanics, 9 resources with mechanics, 4 creation pages, 46 enumerated types.
The increment reduced the total from 1,875 by implementing `resourceArray`,
`select`, `collapsible`, `button`, `resource`, `ticker`, `viewPager` and
`menuButton` rendering; declared events and `create_if_empty` stay reported.

Existing collection formulas, scoped drafts, supported source popups, atomic
saves and combat initialization are not listed as missing. Their limits remain
documented in [VIEWS](docs/VIEWS.md) and [COMPATIBILITY](docs/COMPATIBILITY.md).
Public GitHub root/`.git` retrieval is implemented separately; it does not
complete external content-archive support. See [GitHub import](docs/GITHUB_IMPORT.md).

## 1. Contexts, references and incomplete characters

- [x] Implement the `$edit_mode` view scope: false on rendered sheets, true inside
  a real draft session.
- [ ] Implement real `$character`, `$parent` and `$is_new` scopes
  with verified ownership, nesting, cache isolation and lifecycle semantics.
- [ ] Support required nested resource read/write paths, preserving exact
  system pins and patching the latest owner atomically.
- [ ] Resolve the empty-class saving-throw failure: `classes=[]` currently
  produces null proficiency, which fails the strict boolean `when` condition.
- [ ] Handle unselected race/class states through verified source behavior and
  creation flow. Reproduce `race.current_level_traits` and `race.name` failures;
  do not fabricate an empty race or coerce null conditions to false.
- [ ] Resolve the 13 unresolved stat references left by missing scopes:
  `$view.<select>_select` popup targets, `$resource.traits`/`actions`/`reactions`/
  `legendary_actions` on the monster view and `monster.photo`/`armor_class`/
  `initiative`/`speed`, plus `current_hp`/`max_hp` in resource stat scopes.
  Confirm whether each is a diagnostic scope gap or a real source feature.

## 2. Remaining formulas and resource operations

- [x] Implement `notNull`, `enumeratedName`, `enumeratedAbbreviation`,
  `toNum`, `toSignedString` and `replace`. Enumeration labels resolve inherited
  entries and fail for unknown ids; `toNum` rejects non-decimal text and
  `replace` is literal, all-occurrence and bounded.
- [ ] Verify and implement `eventName`, which needs a real event scope.
- [ ] Verify and implement `split`; the public page documents a plain separator
  while the pinned source passes a regular expression, so semantics are unverified.
- [ ] Verify and implement `copyResource`, including identity, references and
  clone ownership; do not assume shallow or deep copying semantics.
- [ ] Implement `createChip` and dynamic `listItem.chips` evaluation/rendering.
  `chips` is declared on 21 list/search views and holds the 18 `createChip` nodes.
- [ ] Verify and implement `forEach` (9 nodes, effect iteration), `append` (1 node)
  and the `copyResource` clone semantics used by creation `post_edit` effects.

## 3. Missing source views and controls

Implemented in the view increment: `resourceArray` display/edit/list rendering
with create/remove, `pop_up_type`, `left_view`, `hide_line`, `auto_add_first`;
`resource` display/edit/list rendering; enumerated and resource-backed `select`
(including `multi_select`, `max_selection_amount`, `style: list`); `ticker`
(bounds, step, direct edit, styles, `$edit_mode` visibility); `collapsible`;
`viewPager`; `menuButton` options; `button` text/enabled state.

- [x] Implement `resourceArray` rendering, including `class_features_subsection`.
  Nested editing of instances created inside one draft session remains missing.
- [ ] Implement the validated operands editor `value_calculator_edit`.
- [x] Implement `resource` and enumerated `select` controls.
- [ ] Implement `menuButton` event dispatch, including `skills_section_menu` and
  `lifecycle_events_button`. Source options already render; choosing one does not
  run its event.
- [x] Implement `viewPager`, `ticker`, `collapsible` and `button`. `diffText`
  and button event dispatch remain unimplemented.
- [ ] Implement dynamic stat bounds on `stat` views: `calculated_min_value_allowed`
  and `calculated_max_value_allowed` (ticker bounds are implemented).
- [ ] Implement stat interactions: `on_tap_event` and `on_long_tap_event`.
- [ ] Implement stat sheets: `bottom_sheet_view`, `bottom_sheet_in_edit_mode`,
  `sheet_title` and `edit_bottom_sheet_title`.
- [ ] Implement `stat_color` and `name_color` using safe source color handling.
- [ ] Complete checkbox `switcher` and `should_auto_save`, vertical dividers,
  selection `filters`, resource `search_filters` and `sort_options`.
- [ ] Verify and implement remaining popup options: `extra_buttons`,
  `in_edit_mode` and `dismissible`.
- [ ] Implement avatar `avatarSection` action hooks `bottom_left_button_event` and
  `bottom_right_button_event`, and the checkbox `style: switcher` variant.
- [ ] Verify the behavior of resource metadata `is_encounter_template` and
  `is_combatant_entry` before treating those fields as supported.

## 4. General events, effects and mechanics

- [ ] Establish event scopes, execution order, aggregation, reversal and
  failure semantics from upstream documentation and pinned examples.
- [ ] Implement the general effect pipeline, including iteration, stat changes,
  event forwarding, delayed effects, messages and resource/popup actions.
  Existing combat initialization supports only its documented subset.
  Source evidence: 101 `setStat`, 24 `sequence`, 16 `roll`, 14 `addToStat`,
  11 `fireEvent`, 5 `delayed`/`showMessage`/`dismissResource`/`forEach`,
  4 `showPopUp`, 3 `copyResource`, 2 `forwardEvent`/`showResource`.
- [ ] Execute and verify all 21 system mechanics and the resource mechanics,
  including rests, daily events, condition removal, proficiency changes and
  source-defined stat rolls.
- [ ] Keep commands bounded and atomic. Never trigger events, initialization
  or rolls during rendering, reopening or backup restoration.

## 5. Official character creation and progression

- [ ] Execute original creation pages, navigation, conditions and validations.
- [ ] Implement `on_page_open`, `on_page_close`, `pre_edit` and `post_edit` with
  verified draft, confirmation, cancellation and repeated-operation behavior.
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
