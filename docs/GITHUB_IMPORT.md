# Public GitHub system retrieval

## Use

1. Open **Libreria sistemi → Da URL**.
2. Enter a public GitHub repository root, for example
   [derpsyhome/3rd-party-books-for-5e](https://github.com/derpsyhome/3rd-party-books-for-5e),
   optionally ending in `.git`.
3. Optionally enter a branch or commit. An empty field uses the default branch.
4. Choose **Carica anteprima**, select the discovered file, then choose
   **Carica file selezionato**.
5. Review compatibility and provenance. Only **Conferma importazione** writes
   the immutable system to IndexedDB. Closing the preview installs nothing.

HTTPS roots, `git@github.com:owner/repo.git`, `ssh://git@github.com/owner/repo.git`
and `git://github.com/owner/repo.git` normalize to the same public HTTPS reader.
These forms do not invoke Git, SSH or a clone operation. Other Git hosts,
private repositories and authenticated URLs are not supported.

Existing direct HTTPS JSON/gzip-JSON imports remain available. GitHub
`blob`/`tree` page URLs are rejected with instructions to use a root URL plus
the reference field. For unconventional filenames, use the direct Raw URL.

## Contract and provenance

The implementation uses documented public read endpoints:

- [List commits](https://docs.github.com/en/rest/commits/commits#list-commits):
  `GET /repos/{owner}/{repo}/commits?per_page=1`, with optional `sha`.
  The response's first `sha` identifies the selected immutable commit;
  `commit.tree.sha` identifies its root tree.
- [Get a tree](https://docs.github.com/en/rest/git/trees#get-a-tree):
  `GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1`.
  Only complete trees and regular blobs are considered.
- Download only the selected file from
  `https://raw.githubusercontent.com/{owner}/{repo}/{commit}/{path}`.
  Response-supplied download URLs are never followed as discovery instructions.

The candidate names are `system.rpg`, `system.rpg.json` and `system.json`,
case-insensitive, anywhere in the tree. Symlinks, submodules, distribution
indexes and resource archives are not candidates. A name does not prove that a
file contains a valid system: the normal byte/decompression/UTF-8/schema and
compatibility checks still run. Split authoring roots are not assembled.

The commit is resolved before the tree and file are read, so a moving branch
cannot silently switch the selected source. Stored provenance is the
commit-pinned Raw URL without input query strings or fragments. Import identity
still hashes exact uploaded/downloaded bytes. Export, backups and character
version pins use existing immutable-source behavior.

## Bounds and failure behavior

- Two metadata reads plus one download per selected file; no repository crawl,
  archive download, automatic retry, background sync or imported code execution.
- Each response is streamed with an 8 MiB ceiling and a 15-second timeout.
  Existing JSON node/depth and independent gzip expansion limits also apply.
- At most 20,000 tree entries and 100 candidates. Truncated/oversized trees,
  invalid paths, duplicate candidate paths and inconsistent metadata fail
  explicitly instead of presenting a partial scan as complete.
- A candidate larger than 8 MiB blocks discovery with a visible error. Use a
  direct URL to an eligible file when another candidate exceeds the limit.
- An unassembled split authoring root (system identity without the required
  collection roots) is rejected with a specific message; sibling `.rpgs` files
  are never merged into it.
- The selected download must match its declared size. Git LFS substitution
  is not supported by this reader.
- Requests omit cookies/referrers and use no token. Public API rate limits,
  private/missing repositories, empty repositories, HTTP, timeout and
  network/CORS failures remain visible. No proxy bypasses browser restrictions.
- GitHub receives normal request/IP metadata and the requested public
  repository/ref/path, never local characters, photos or backups.

## Verification

`tests/github.test.ts` provides bounded contract fixtures derived from the
documented response shapes. Production browser tests exercise the real app
against controlled GitHub/Raw responses, including selection, invalid content,
preview cancellation, confirmation, original export and offline reopening.
These fixtures use original MIT example content, not third-party game content.

An intentional live, read-only check uses the pinned derpsy commit
`00f55b2c3023c59f5857297dc933a7505c9b6aa4` and `5e/system.rpg`:

```powershell
$env:PLAYWRIGHT_PORT = '4183'
$env:PLAYWRIGHT_BASE_PATH = '/PolySheet/'
$env:LIVE_GITHUB_IMPORT = '1'
npm run test:e2e -- --grep 'live public GitHub'
Remove-Item Env:LIVE_GITHUB_IMPORT
```

Run against a production build. See [executed results](VERIFICATION.md);
controlled fixtures alone do not establish public availability or CORS.
