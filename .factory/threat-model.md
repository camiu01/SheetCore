# Threat Model for SheetCore

Last updated: 2026-11-13. Version: 1.0.0. Method: STRIDE.
This is a source review, not a penetration-test or compliance certification.

## 1. System Overview

SheetCore is a static React/TypeScript PWA. It has no backend, account service,
authentication tokens, shared server database, or automatic cloud synchronization.
Dexie stores characters, immutable source imports, resources, encounters, rolls
and preferences in the current browser origin's IndexedDB.

| Component | Entry point | Security responsibility |
| --- | --- | --- |
| Import boundary | Local JSON/gzip files and explicitly entered HTTPS URL | Byte/decompression/UTF-8/schema/node/depth bounds; retain exact originals |
| Rule interpreter | Imported formula/view trees | Explicit registries, own-property paths, type checks, operation/depth limits; never eval |
| Persistence | Base-field patches, encounter commands, backup restore | Exact-version pins, referential integrity, coherent/atomic transactions |
| UI/photo layer | Source labels, form values, local raster images | React escaping; no remote images; bounded raster dimensions and bytes |
| PWA/static host | App assets, service worker, update prompt | Same-origin shell caching; never publish local browser records |
| Build and CI | Locked npm packages, GitHub workflow, optional fixture scripts | Trusted application code only; least privileges; publish only verified dist |

Data flows from explicitly selected files/URLs through bounded validation to a
preview. Confirmation installs the immutable version. Commands validate mutable
values before transaction commit. Backup replacement validates all sources and
relations before clearing any table. Downloads use local Blob URLs, not uploads.

## 2. Trust Boundaries & Security Zones

1. Untrusted input: source definitions, backups, photos, response headers/bodies,
   and user-entered URLs. Filenames and source labels are text, never commands.
2. Browser-local application: validated records and explicit commands. Browser
   profile/origin isolation is the data boundary, not a claimed user-auth system.
   Any same-origin malicious script or privileged extension could read IndexedDB.
3. Build/publication: trusted repository and locked dependencies. Untrusted RPG
   input is data, never build code. PR checks cannot deploy or receive Pages
   write privileges. Publishing main is a deliberate maintainer operation.

The optional HTTP reader omits credentials/referrers and never sends characters,
photos or backups to the selected host. The host still sees normal request/IP
metadata. Remote URL import is user initiated and subject to browser CORS.

## 3. Attack Surface Inventory

- No application API, webhook, OAuth callback or server upload endpoint exists.
- JSON/system inputs: 8 MiB raw and expanded, 400,000 values, depth 64.
- Backups: 32 MiB and bounded record counts; sources rehashed and revalidated.
- Formulas: 10,000 operations/depth 64, safe direct/nested/optional path grammar;
  prototype-related keys are forbidden at parse and path boundaries.
- Combat: 100 actors; bounded initialization/rolls; no imported code or arbitrary
  general effects. Unsupported initializer options fail rather than being ignored.
- Photos: 1 MiB PNG/JPEG, dimensions at most 4096 per axis, canonical Base64.
  Browser file selection also tests actual image decoding before saving.
- HTTPS reader: no URL credentials; timeout and streamed bounds; cookies omitted.
  It does not crawl repositories, proxy requests or merge remote documents.
- Local fixture scripts: argument-array Git subprocesses at pinned commits;
  no external compiler/tool code execution or automatic publication.

## 4. Critical Assets & Data Classification

Characters, names, notes and photos are user data and can contain personal
information. They stay local and are not application telemetry. Backups are
unencrypted local files and must be handled as private documents.

Original source text, compressed bytes and import identity protect reproducibility,
not authenticity of an external publisher. SHA-256 is an integrity identity, not a
signature or an authorization mechanism. Licensing/provenance restrictions remain.

No runtime credentials are required. GitHub's deployment OIDC token is job scoped.
Do not commit tokens, private keys, browser records, exports or reference content.

## 5. Threat Analysis

Severity/likelihood below describe the potential impact before the listed controls.
They are threat scenarios, not assertions of exploitable findings.

| Component | STRIDE scenarios | Controls | Remaining risk |
| --- | --- | --- | --- |
| Imports | S: misleading publisher labels; T: altered originals; R: disputed input; I: token-bearing provenance; D: compression/depth bombs; E: executable payload | Explicit preview/source warning; exact hashes; query-free provenance; bounded streams/parser; no execution | Medium/possible: no publisher signatures or licensing verification |
| Interpreter | S: forged contextual identity; T: prototype traversal/coercion; R: opaque outcomes; I: unrelated scope access; D: cycles/list growth; E: arbitrary code/effects | Trusted scope objects, own properties, typed references; visible errors; shared budgets/cycle detection; explicit roll capability and initializer allowlists | Medium/possible: partial upstream semantics; large-library performance not certified |
| Persistence/backup | S: foreign system IDs; T: dangling links/partial restore; R: no audit ledger; I: local data access; D: quota exhaustion; E: computed-field writes | Same-version validation, source rehashing, transaction rollback, base-only patches and constrained initializer overrides | Medium/possible: local profile compromise, eviction, and last-save-wins manual resource forms |
| UI/photos | S: source text posing as app text; T: HTML/SVG/script input; R: accidental edits; I: remote image beacons; D: large images; E: event execution | Visible source/support labels; React text; PNG/JPEG-only data URLs; no remote images; confirmations and save indicator; events unsupported | Medium/possible: no encryption or protection against malicious browser extensions; headers depend on host |
| PWA/host | S: compromised host; T: replaced assets; R: unclear update origin; I: same-origin compromise; D: stale/evicted caches; E: malicious service worker | HTTPS deployment, prompt-based updates, shell-only precache, independent IndexedDB | High/uncommon: host/dependency compromise is outside application input controls; two-version rollout untested |
| CI/tooling | S: substituted dependencies/actions; T: PR deployment; R: unclear provenance; I: credential/artifact disclosure; D: hostile build tooling; E: excessive token permissions | Lockfile, full action SHA pins, no persisted checkout credentials, read-only verify, dependent deployment gate, dist-only artifact, fixed Git argument arrays | Medium/possible: known development-tool advisories; Actions/Pages hosted run still requires verification |

## 6. Vulnerability Pattern Library

Reject dynamic execution of imported content (`eval`, `new Function`, script
injection), HTML sinks (`dangerouslySetInnerHTML`, `innerHTML`), remote photo
`src` values, prototype traversal, and shell interpolation.

```ts
// Safe: a known formula handler, not eval(source.components).
const handler = formulaHandlers.get(node.type);
// Safe: an own property only, after path grammar checks.
Object.hasOwn(record, id);
// Safe: source text remains React text, not raw HTML.
<p>{sourceText}</p>
```

```js
// Safe local inspection: fixed Git object, separate argv, no shell.
execFileSync('git', ['-C', repo, 'show', `${pinned}:5e/system.rpg`]);
```

SQL injection, backend authentication bypass and tenant IDOR are not current
surfaces because no SQL/backend/accounts exist. Equivalent local hazards are
foreign-version links, calculated-field mutation and unchecked backup replacement.
If a backend is ever added, this model must be revised before reusing those claims.

## 7. Security Testing Strategy

Vitest tests schema/type/hash tampering, unsafe keys, recursion/size limits,
reference pins, conflicting writes, initializer refusal and atomic rollback.
Playwright tests actual production decompression at the byte boundary, escaped
source content, malformed input, raster rejection, offline persistence and
confirmed backup replacement on desktop/mobile.

CI runs the runtime dependency audit, strict types, unit tests, production build
and browser suite. The threat-model metadata is documentation, not an installed
automated LLM scanning service or a new enforced CI gate.

## 8. Assumptions and Accepted Risks

- Users control their browser profile. IndexedDB and exported backups are not
  encrypted, authenticated shared storage. No immutable edit audit is claimed.
- Site-data deletion/eviction, exhausted quota, malicious extensions and a
  compromised host can lose or disclose data. Keep private offline backups.
- React escaping and inert images reduce input risks; CSP/security headers are
  host controlled and cannot be configured arbitrarily by this Pages workflow.
- Existing build-chain advisories are recorded in `docs/VERIFICATION.md`; runtime
  audit is separate. Build trusted application code only.
- General mechanics/events, external resource archives and complete upstream
  compatibility are not provided. Do not infer them from import success.
- Manual resource dialogs save a staged record; conflicting edits in another tab
  can be overwritten on save. Character/combat field commands patch latest records.
- No security contacts or compliance framework were supplied; none is invented.

## 9. Version Changelog

- 1.0.0 (2026-11-13): Initial model covering source imports, contextual evaluation,
  typed photos/references, encounters, backup v3, offline storage and Pages CI/CD.
