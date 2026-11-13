# Combat and contextual fields

This is a verified command subset, not a complete RPG Companion rule engine.
All displayed system labels and formulas come from the pinned import.

## Use

1. Import a system defining `combat_system`. Existing imports receive current
   diagnostics without rewriting their original text, compressed bytes or identity.
2. Create required local resources in **Risorse**. The archive name is separate
   from the source's `name` stat. Assign nested references in the typed base editor.
   For the inspected 5e monster, create a `dice_roll` resource with `dice_amount`,
   `dice_type` and `constant`, then assign it to the monster's `hit_points`.
3. Open **Combattimento**, name an encounter and choose its difficulty. Add
   source-defined types, selecting a same-version character/template when needed.
4. Roll initiative explicitly or enter it manually. Resolve complete ties manually.
   Start the encounter, then advance turns/rounds. Expand base values to edit HP.
5. Wait for the saving indicator before reloading. Offline reopening and backup
   restore retain HP, initialization overrides, initiative and turn position.
   Supported source popups additionally stage actor fields until their explicit
   Save. Multi-field saves are atomic and retain the existing override/linked-PC
   write rules; cancellation never rolls or modifies persisted values.

## Verified semantics

- Source `stat` dot paths, segment-suffixed `?`, nested local resource definitions,
  `defined`, `metaStat`, `map`/`filter` bindings and uncached reads.
  Deprecated `for_resource` is ignored, as the upstream documentation instructs.
- `concat`/`joinToString` accept strings/numbers without arbitrary coercion;
  lazy `defaultIfNull` replaces null only; `max`/`min` require nonempty numbers.
  Empty class lists can therefore still produce an honest source `max([])` error.
- `created_at` reads the persisted record timestamp. `date` uses the documented
  `MMM dd, yyyy` shape, explicitly English and UTC. The docs do not establish the
  original app's locale/timezone behavior; parity across those settings is unverified.
- Local photo envelope `{url, base64}`; only validated PNG/JPEG bytes are rendered.
  Remote URLs are retained but never fetched. No SVG or external image execution.
- Resource references use SheetCore's own `{resourceId}` representation. Resource
  archives and upstream resource-instance interchange remain unsupported.
- Combat variables include `$combatants`, `$combat`, `$combat_difficulty`,
  `$combatant` and template `$resource`. Initiative is descending, followed by the
  source's numeric tie-breakers. Complete ties never get an invented winner.
- `perCombat` retains initiative between rounds; `perRound` rerolls on an explicit
  advance command. Source initiative degradation and minimum thresholds define
  passes. No automatic removal/skipping of dead combatants is invented.
- A new instance runs only synchronous `sequence` and `setStat` with aggregation
  `set`, one override per direct destination. Rolls are bounded `xdy +/- n`,
  use cryptographic randomness and are committed atomically with the instance.
  Unsupported initialization fails visibly and adds nothing.
- Linked player characters remain live same-version records. Combat field patches
  preserve concurrent edits to other fields. Local instance overrides stay separate
  from base values and from immutable source definitions.
- In the inspected Archer/derpsy systems, source enemy HP controls encounter
  resolution and the XP summary. XP is displayed, **not automatically granted**.
  Healing a source-resolved encounter can make it active again.

## Not implemented

General mechanics, event dispatch, lifecycle effects, stacking/reversal, equipment
automation, official character creation, unsupported resource views, generic Rollable
actions and book/class/race archives. Unsupported fields stay diagnosed; imported
systems remain labelled partial. Initializer support does not imply general
effect-engine compatibility.

The original MIT regression fixture exercises typed editors and combat in both
browser profiles. Optional pinned-source tests additionally execute real monster
initialization and XP formulas without modifying or distributing source documents.
See [verification](VERIFICATION.md) and [safety limits](ARCHITECTURE.md).
