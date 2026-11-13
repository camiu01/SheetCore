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

The selected group contains the unchanged source input objects inside a local
wrapper. Its original group validation is retained. Other source properties
remain unchanged in the immutable import and export.

## `$view` and transactions

Each form owns a draft dictionary keyed by its source input IDs. Text and numeric
keystrokes update drafts immediately; booleans and resource selections do too.
Source formulas see those values through `$view`. No empty global `$view` or
cached copy of committed character values stands in for interactive state.
Outside a session, optional `$view?.field?` access can return null; required
access still fails.

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
| `section` | `always_show_collapse_icon`: false/default shows the marker only while collapsed; true retains it when expanded |
| `list`, `checkbox` | Per-edge padding; bool labels/alignment and checkbox style inside scoped forms |

Colors are documented palette names mapped to SheetCore theme tokens, or bounded
hex literals. Imported CSS, URLs and arbitrary style expressions are rejected.
Text line clamping is visual and never truncates persisted source/user values.
Resource-backed text accepts ID strings/string arrays, not an upstream resource
archive or an arbitrary global ID lookup.

## Remaining limits

- General events, menu buttons, enumerated selectors and page lifecycle effects
  remain unsupported and diagnosed. A visible condition chip is not a substitute
  for its unimplemented removal event.
- Selection is from local records, explicitly not an external compendium.
  Filter maps, unknown enum variants and unsupported optional fields stay
  diagnosed; non-null filters block selection rather than being silently ignored.
- Nested stat write paths are not implemented by these forms. Open the actual
  referenced resource for editing; calculated target fields cannot be overwritten.
- Popup `extra_buttons`, `in_edit_mode`, `dismissible`, checkbox-specific autosave,
  dynamic stat bounds/colors and dynamic list chips are not accepted as supported.
  The documented subset uses explicit root Save, or an enclosing draft session.
- Resources without a source edit view retain the explicit manual editor. That
  fallback still saves a whole staged record and can overwrite same-record edits
  from another tab.

See [source evidence](COMPATIBILITY.md) and [executed checks](VERIFICATION.md).
