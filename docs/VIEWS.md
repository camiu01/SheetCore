# Source views and scoped editing

This is a tested subset, not full upstream UI/event compatibility. Source
documents and version pins remain immutable. All application controls are
Italian; imported labels retain their original language.

## Use

- Open a supported source popup, change its inputs, then choose **Salva** or
  **Annulla**. Save validates the entire form and patches only changed fields.
  Reopening a cancelled popup starts from persisted values.
- In a source resource section, add a local instance through `selectResources`.
  Inline creation uses the resource's original `edit_view`. Empty-note validation
  blocks creation. Resource creation and owner assignment are one transaction.
- Open **Dettagli** to see the resource's `display_view`, then **Modifica** for
  its source edit form. **Scollega** removes the reference, not the archive record.
  Reorganizable lists offer drag/drop and labelled up/down controls.
- Expand **Campi delle pagine sorgente · modifica manuale** to choose a group
  of original inputs. This is explicitly a manual projection. It does not apply
  the original group's visibility, run page lifecycle hooks, select a generation
  mode, enforce a complete character-creation workflow or trigger mechanics.
  Individual input conditions, bounds and validation remain active.
- In **Risorse**, **Apri editor manuale dei valori base** remains available even
  when a resource's source form fails. Its warning explains that switching
  discards the unsaved source draft. Manual editing validates types and exact
  system references, not source form rules, events or official creation.

### Completing the reported 5e HP prerequisites manually

For the exact uploaded `5e` `0.6.0` fixture documented in
[compatibility](COMPATIBILITY.md#reported-empty-class-hp-failure):

1. In **Risorse**, create a local `Class` using the manual base editor.
   Set its archive name and source `Name`; enter actual class values yourself.
   No class compendium or game content is imported automatically.
2. Create a local `Class details` through the manual editor, assign its `Class`
   to that instance and enter `Class level`.
3. Reopen the character and expand **Valori base · modifica manuale**. In
   `Classes`, select the **Class details** instance, not the Class instance.
   The archive's **Collega** button only adds notebook metadata and is not
   equivalent to assigning the typed `Classes` field.
4. Enter the actual `Base HP` and `Constitution`. The original source calculation
   now has its prerequisites. The tested example uses level 2, Constitution 14
   and base HP 10, producing maximum HP 14. Those numbers are regression inputs,
   not defaults or advice about a particular class.

The empty-class error remains honest until the required records are assigned,
but it no longer blocks navigation or editing. Other unsupported source features
remain visible; this is not an official character-creation or leveling workflow.

The selected group contains the unchanged source input objects inside a local
wrapper. Its original group validation is retained. Other source properties
remain unchanged in the immutable import and export.

## `$view` and transactions

Each form owns a draft dictionary keyed by its source input IDs. Text and numeric
keystrokes update drafts immediately; booleans, tickers, selects and resource
selections do too. Source formulas see those values through `$view`. No empty
global `$view` or cached copy of committed character values stands in for
interactive state. Outside a session, optional `$view?.field?` access can return
null; required access still fails.

Validation formulas must return null for validity or a visible string otherwise.
Wrong result types, evaluator failures and invalid numeric inputs prevent Save.
Source-calculated stats with direct dependencies on the current form's input
IDs render as read-only draft results. Point-buy costs therefore update before
persistence. No independent point-buy rule or budget is invented.

Nested popups have separate scopes. Their Save stages into the enclosing form;
the outer Save commits. Closing/cancelling the outer form discards all staged
changes and newly created instances. Existing resource record editing is not
offered from inside a draft list; close the draft and edit from its saved list.

Character/resource/combat forms patch latest owners in Dexie transactions.
Array append/unlink/reorder reads latest values. New instances must match the
owner's exact system import. Invalid references, missing owners or failed
validation roll back the entire command, including newly created resources.
Same-field conflicts use transaction order. Different-field updates are retained.
No initializer, roll, event or mechanic runs during form rendering or restore.

## Verified rendering

| View/field | Implemented behavior |
| --- | --- |
| `avatarSection` | Center content and left/right stacks; event button titles stay visible with an unsupported-event label |
| `icon` | Explicit source-name mapping to local Lucide glyphs; small/medium/large sizes and safe source colors, not original upstream artwork |
| `selectResources` | Correct definition/pin, scalar or array assignment, append/replace, preserve-ID or local clone, inline creation, selected labels; non-autosave selection waits for explicit form Save |
| `resourceSection` | Original list/display/edit views; read-only controls, base target guards, preview expansion, responsive width/alignment, unlink and drag/keyboard reordering |
| `popUpButton` | Icon/text trigger, bottom-sheet or alert dialog, source title/button text, source validation and Save/Cancel; root persistence requires `should_persist_on_save=true`, or an enclosing draft owner |
| `chip` | Plain or resource-backed text, compact/full size, whitelisted background/border colors; no guessed tap event |
| `text` | Plain text, numeric sign, visual line clamp, safe color, local resource IDs resolved against exact type/pin and display stat |
| `listItem` | Source title/subtitle and first/second-line extras with formula colors; dynamic `chips`/`createChip` remain unsupported |
| `collapsible` | Source title/subtitle, `start_expanded` state and nested subviews |
| `viewPager` | One page at a time with source page names and the declared palette/hex color; page state is local presentation only |
| `ticker` | Numeric base stat with `plusMinus`/`upDown` buttons, `left`/`right`/`sideToSide` placement, label and alignment, fixed or calculated bounds, `allowed_values`, `change_amount` (including 0), `always_show_sign`, `hide_value`, direct edit and headline/title/section/subhead text styles |
| `select` | Enumerated `options` with `extends_type` inheritance and `allowed_options`, local `resource_options` or resource-type instances, `multi_select`, `max_selection_amount`, dropdown/list styles, `meta_stat`, `options_display_stat` and `resource_saved_stat` |
| `menuButton` | Source icon name/size/color and enumeration entries; choosing an entry cannot execute its declared event |
| `button` | Source text and `enabled` state; declared `event`/`event_names` stay disabled with a visible note |
| `resource` | One referenced instance through its `display`, `edit` or `list` view; direct field edits outside a draft session; an empty `create_if_empty` is reported, not executed |
| `resourceArray` | Referenced instances with `display`/`edit`/`list` views, `left_view`, bottom-sheet or window detail, create/remove, `auto_add_first`, `hide_line` and hidden content lines |
| `section` | `always_show_collapse_icon`: false/default shows the marker only while collapsed; true retains it when expanded |
| `list`, `checkbox` | Per-edge padding; bool labels/alignment and checkbox style inside scoped forms |

Colors are documented palette names mapped to PolySheet theme tokens, or bounded
hex literals. Imported CSS, URLs and arbitrary style expressions are rejected.
Text line clamping is visual and never truncates persisted source/user values.
Resource-backed text accepts ID strings/string arrays, not an upstream resource
archive or an arbitrary global ID lookup.

## Remaining limits

- General events and page lifecycle effects remain unsupported and diagnosed.
  Buttons and menu buttons render their source text and options, keep the declared
  event visible and never execute it. A visible condition chip is not a substitute
  for its unimplemented removal event.
- `$edit_mode` is true only inside a real draft session and false on rendered
  sheets. It does not simulate the original app's global edit toggle.
- Selection is from local records, explicitly not an external compendium.
  Filter maps, unknown enum variants and unsupported optional fields stay
  diagnosed; non-null filters block selection rather than being silently ignored.
- Nested stat write paths are not implemented by these forms. Open the actual
  referenced resource for editing; calculated target fields cannot be overwritten.
- `resource` inline creation (`create_if_empty`) is not executed and stays
  diagnosed instead of silently inventing a record.
- Popup `extra_buttons`, `in_edit_mode`, `dismissible`, checkbox-specific autosave,
  dynamic stat bounds/colors and dynamic list chips are not accepted as supported.
  The documented subset uses explicit root Save, or an enclosing draft session.
- Resources with or without a source edit view can use the explicit manual
  editor. Existing-record saves patch changed fields against the latest record;
  unrelated concurrent fields and untouched archive names survive. Same-field
  changes remain last-committed-write wins. Failed saves retain the draft and
  leave stored data unchanged; saving disables inputs and modal dismissal.
- Rendering failures remain confined to the failing source view, including
  exceptions thrown by deferred React child components. Changed input/context
  snapshots retry rendering without weakening formula errors or form validation.

See [source evidence](COMPATIBILITY.md) and [executed checks](VERIFICATION.md).
