# Content provenance and third-party notices

## Distributed original material

| Material | Author | Source | License |
| --- | --- | --- | --- |
| PolySheet application and documentation | PolySheet contributors | This repository | MIT, `LICENSE.md` |
| Sentieri example | PolySheet contributors | `src/demo.ts` | MIT |
| App icon and mountain/monogram artwork | PolySheet contributors | `public/icon.svg`, `scripts/icons.mjs`, UI/CSS | MIT |

No photos, external game rules, copyrighted game descriptions, or remote fonts
are bundled. Lucide icons are provided through `lucide-react`; retain its ISC
license and the licenses of other installed dependencies when redistributing.
`package-lock.json` pins dependency provenance. This application's license
does not replace those dependencies' licenses.

## External, local-only reference material

The user-supplied diagnostic fixture `.reference/reported-system.rpg` remains
local and gitignored. Its exact-upload hash, declared system version and limits
are recorded in `docs/COMPATIBILITY.md`; no upstream revision or redistribution
permission is inferred from that upload.

- Source: [RPG Companion App open systems repository](https://github.com/blastervla/rpg-companion-app-systems).
- Attributed author: **Blastervla Enterprises**.
- Product/source attribution: [rpg-companion.app](https://rpg-companion.app/).
- Current inspected revision:
  [8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4).
- Test source revision:
  [92b8128a1e6da7ed39406012e357d1e3d0e1792b](https://github.com/blastervla/rpg-companion-app-systems/tree/92b8128a1e6da7ed39406012e357d1e3d0e1792b).
- Exact test input: `systems/5e/system.rpg.json`.
- Derived local test input: selected name, six ability scores, six ability
  modifiers, abilities section, and note definition, as documented in
  `docs/COMPATIBILITY.md`. Root ID/name identify this as a slice. Unrelated
  character rules, sections and resource types are removed. Retained source
  objects are not rewritten.
- Local files: `.reference/5e.json`, `.reference/5e-slice.json` and the reference
  checkout. These are gitignored and excluded from the built app.

### Conflicting license statements

At both inspected revisions, the reference `LICENSE.md` states
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), attribution to
Blastervla Enterprises, noncommercial use, and ShareAlike as recommended.
Its README and public documentation instead state
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), and the
README additionally calls scripts/tools MIT without a corresponding full MIT
grant in `LICENSE.md`.

PolySheet does **not** decide that one statement supersedes another. No external
creative content or tool code is distributed. Before redistributing any local
fixture, subset, game text, tool, or image, resolve the applicable license and
any underlying third-party rights with the rights holder. In particular, do not
include these fixtures in a commercial distribution under PolySheet's MIT
license. Keep the source attribution and applicable conditions with any
authorized redistribution.

This project is not official, endorsed, or approved by RPG Companion App,
Blastervla Enterprises, or any game publisher.

## Additional user-provided compiled reference

[WaMXXVII/Archer-class](https://github.com/WaMXXVII/Archer-class), revision
[378bdf68f055bae8777a233fc0ac6e4f9eb6145c](https://github.com/WaMXXVII/Archer-class/tree/378bdf68f055bae8777a233fc0ac6e4f9eb6145c),
contains `systems.rpg`, `5e/system.rpg`, `5e/resources.rpg`, and
`5e/resources.rpg.gzip`. No license or attribution grant was found among the
tracked files. A public repository is not a redistribution license.

Only local inspection and compatibility tests use this checkout and the
extracted `.reference/archer-system.json`. Both stay gitignored and outside
`src/`, `public/`, and `dist/`. The extraction script contains no game content.
It does not grant rights to distribute the payload, its derived JSON, class
text, or resource-instance archive. Obtain permission before redistribution.

## Reported third-party books repository

[derpsyhome/3rd-party-books-for-5e](https://github.com/derpsyhome/3rd-party-books-for-5e),
revision
[00f55b2c3023c59f5857297dc933a7505c9b6aa4](https://github.com/derpsyhome/3rd-party-books-for-5e/tree/00f55b2c3023c59f5857297dc933a7505c9b6aa4),
was inspected to diagnose the supplied URL and verify its `5e/system.rpg`
gzip-JSON envelope. Only the pinned system blob is exported locally to
`.reference/derpsy-system.rpg`. No book text or resource archive is distributed
or imported. The root tree did not provide a license. Copyright and permission
for the advertised third-party books must not be inferred from public hosting.

The original Archer blob is likewise exported locally as
`.reference/archer-system.rpg`. `scripts/package-fixtures.mjs` prepares exact
Git blobs for tests; it contains no third-party creative content or copied tool
code. These binary fixtures and reference repositories remain gitignored and
outside the production build.
