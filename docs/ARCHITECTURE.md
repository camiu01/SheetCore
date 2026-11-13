# Architecture

## Layers and ownership

| Location | Responsibility |
| --- | --- |
| `src/domain/model.ts` | Passthrough source schemas and explicitly separate internal records |
| `src/importing/system.ts` | Bounded JSON parsing, structure, semantic diagnostics, provenance/hash |
| `src/importing/package.ts` | Bounded native gzip-JSON decoding and exact binary-source retention |
| `src/importing/url.ts` | Direct HTTPS downloads, URL/HTML/HTTP/timeout/network diagnostics |
| `src/engine/formulas.ts` | React-independent formula registry and bounded evaluator |
| `src/engine/dice.ts` | Bounded manual dice expression and unbiased random faces |
| `src/persistence/db.ts` | Dexie schema, migrations, immutable imports and transactional writes |
| `src/persistence/backup.ts` | Backup v3, legacy v1/v2 restore, integrity/relation checks, atomic restore |
| `src/engine/combat.ts`, `src/persistence/combat.ts` | Pure combat evaluation and atomic, source-pinned commands |
| `src/ui/CombatTracker.tsx`, `src/ui/FieldInput.tsx` | Encounter controls and typed base editors |
| `src/domain/photo.ts`, `src/domain/references.ts` | Bounded raster images and exact-version reference integrity |
| `src/ui/renderer.tsx` | View registry, safe plain-text rendering, scalar inputs and fallbacks |
| `src/ui/store.ts` | Only ephemeral navigation, selection and search, not copies of DB data |
| `src/ui/it.ts` | Initial Italian UI catalogue |
| `src/ui/Library.tsx` | Local/HTTPS file import preview and confirmation |
| `src/ui/Characters.tsx` | Manual character creation, source sheet, manual base editor |
| `src/ui/Tools.tsx` | Local resources, notebook links, dice, diagnostics, settings, backup |
| `vite.config.ts` | Manifest, update-prompt worker and shell precache |
| `src/importing/external-slice.ts` | Test-only explicit source projection; not imported by the application |

## Source mapping

The runtime does not invent a normalized game schema. The validated definition
retains the original names and unknown properties through passthrough schemas.
The exact imported text is retained separately as `StoredSystem.original`.
For gzip-JSON uploads, `original` holds exact decoded JSON and
`StoredSystem.artifact` holds `{format: "gzip-json", base64: "..."}` containing
the exact compressed upload, not a recompression. Export emits the retained bytes.
`definition.character_stats` supplies stat definitions;
`character_sheet_sections[].view` supplies sheet nodes. Resource definitions
remain in `definition.resources`, not in the mutable local instance table.

An import key is `source-id@source-version:sha256-exact-upload`. For JSON this
hashes the exact UTF-8 text, including an optional BOM; for gzip it hashes the
compressed file. Whitespace-only
changes are distinct snapshots. Identical imports are idempotent. Version strings
are identifiers, not upgrade instructions: no automatic source replacement or
character migration occurs. `min_app_version` is an original-app constraint,
not a SheetCore minimum version.

`Character.values` contains base values only. The evaluator reads that explicit
snapshot and the immutable definition. Calculated character values are not persisted
or written back into the source. Combat instances separately persist only the
verified `on_create` overrides, never source changes. A new evaluator is created after
each persisted edit; memoization is limited to that snapshot.

`ResourceInstance` contains a local definition ID and base values. Its shape is
**not** the original app's resource export format. `Character.resourceIds` links
local notebook records without triggering effects. Typed resource base fields
use an explicitly internal `{resourceId: string}` reference, not a claimed upstream
instance format. Nested/optional paths resolve local records and declared resource
definitions under a shared evaluation budget. Lambda bindings retain outer scopes.
Only explicit combat commands receive combat variables and a roll capability;
rendering never rolls. `$view` and general parent/event scopes remain unsupported.

## Mutation flow

```text
file/direct HTTPS bytes → compressed/raw byte bound
  → optional verified gzip envelope → expanded byte bound
  → strict UTF-8 → JSON depth/node bounds → source schema → diagnostics
  → review/confirm → immutable IndexedDB import
  → manual character defaults → source view registry
  → scalar input blur → validated field patch in transaction
  → Dexie live query → new evaluation snapshot → derived display
```

Each field patch rereads the latest character in a transaction, so overlapping
updates to distinct fields do not overwrite stale state. Same-field updates
use transaction order, last committed write wins. Invalid drafts remain visible
in the input, are not saved, and are not presented as successful writes.

The manual creator does not evaluate original creation pages. Resource forms
are also explicitly manual, not an implementation of the original edit-view
validation lifecycle.

## Safety limits

| Boundary | Limit |
| --- | --- |
| System text | 8 MiB UTF-8 |
| Gzip system | 8 MiB compressed and independently 8 MiB expanded |
| Backup text | 32 MiB UTF-8 |
| Parsed document | 400,000 visited values; nesting depth 64 |
| Character stats per system / stats per resource | 2,000 |
| Resource definitions per system | 1,000 |
| Sheet sections / creation pages | 200 each |
| System mechanics | 5,000 |
| Dice definitions | 100; 2–1,000,000 faces |
| Formula evaluation | 10,000 operations and depth 64 per call |
| Dependency chains | Maximum 64 before import error |
| Roll | 1–100 dice; one expression and one signed modifier |
| Global roll history | User-configurable 1–1,000 |
| Backup records | 100 systems, 10,000 characters, 10,000 resources, 1,000 rolls, 1,000 encounters |
| Encounter | 100 combatants, 100,000 rounds, 10,000 passes; initiative magnitude at most 1 billion |
| Initialization | 1,000 effects, nesting 32, 100 roll expressions; atomic or no added instance |
| Computed collections/text | 10,000 elements / 1 MiB text |
| Local photo | 1 MiB PNG/JPEG; dimensions 1–4,096 per axis; remote URLs never requested |
| URL import | HTTPS, no credentials, omitted cookies/referrer; 15 s timeout; streamed size bound |
| Input text | Generally 10,000 characters; source `max_length` can tighten supported text inputs |

These are application safety limits, not claims about upstream format limits.
Prototype-related keys are rejected at every parsed object depth. The interpreter
does not execute source code or load remote images. Plain React text escapes
HTML. No HTML or Markdown interpretation is offered. Numeric operations require
finite numbers; division by zero fails; integer results must be safe integers.

Some source fields are only partially supported. For example `divide` requires
explicit `down`, `up`, or `none`; `closest` tie behavior is not guessed.
`add`/`subtract` reject mixed nonnumeric operands instead of guessing coercions.
The compatibility matrix states this restriction.

## Database and backup

Dexie schema version 1 defines systems, characters, resources, rolls and
preferences. Version 2 fills missing `revision` and `resourceIds` on existing
characters. Migration does not reset values. A migration test creates a real v1
IndexedDB database and opens it with the current implementation.
Version 3 adds the independent `combats` table without changing existing records.

Backup envelope:

```json
{
  "format": "sheetcore-backup",
  "version": 3,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "systems": [],
  "characters": [],
  "resources": [],
  "combats": [],
  "rolls": [],
  "preferences": []
}
```

Exports read all tables in one transaction and reject output exceeding the
restore schema/size/node limits. Systems export exact JSON text, provenance and
optional original gzip bytes, not duplicated evaluated definitions. Restore reparses every
source, recomputes hashes/diagnostics, validates IDs, values, versions, system
pins and resource links, and only then opens a single replacement transaction.
Any failure leaves the archive unchanged. The UI previews counts and requires
explicit replacement confirmation. All backup versions are internal, never
advertised as an RPG Companion character format.

Backup v2 adds optional gzip originals. Restore accepts legacy JSON-only v1
without changing its source identity; a v1 envelope with binary originals is
rejected. Gzip records are decompressed sequentially during validation to limit
peak memory. Their raw digest, decoded JSON and declared source identity must
agree before replacement. Unknown/invalid/checksum-corrupt/oversized packages
fail without changing live data. No Dexie schema bump is necessary for the
optional, non-indexed artifact field; existing v2 database records remain valid.

Backup v3 adds encounters, source/character/resource pins, initialization overrides,
initiative and turn state. Restore validates references and active-state invariants
before replacement; it never reruns initialization. Legacy v1/v2 backups restore
with an empty encounter table. Base editors use transaction-safe field patches;
the “saving” indicator remains active until the transaction commits.

GitHub repository, `tree` and `blob` pages are rejected before download, rather
than mislabelled as CORS failures. Direct Raw links remain allowed. HTTP status,
HTML responses, network/CORS failures, timeouts, invalid UTF-8 and malformed
payloads have separate diagnostics. No repository is crawled or merged.

## PWA and UI

Workbox precaches the production app shell, generated JS/CSS and local icons.
Imported content resides in IndexedDB. No remote image caching is implied.
A waiting worker triggers an update notice instead of silently replacing an
active session. Service-worker update code is implemented; browser tests cover
activation and offline reopening, not a deployed two-version upgrade rollout.

Native semantic buttons, labelled inputs, `<dialog>` focus trapping, a skip
link, visible keyboard focus, reduced-motion support, and responsive navigation
avoid an additional component framework dependency. Tailwind is installed via
its Vite plugin; the original visual system uses CSS tokens and component
classes. Zustand does not duplicate the persistent domain state.
