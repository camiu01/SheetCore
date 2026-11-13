# CI and GitHub Pages deployment

## Pipeline

Workflow: [`.github/workflows/ci-pages.yml`](../.github/workflows/ci-pages.yml),
displayed as **CI and Pages**.

| Event | Verification | Publication |
| --- | --- | --- |
| Pull request | Yes | Never |
| Push to `main` | Yes | Only after verification succeeds |
| Manual run on `main` | Yes | Only after verification succeeds |
| Manual run on another branch | Yes | Never |

The verification job runs on Ubuntu with Node.js 24:

1. Check out source without persisting Git credentials.
2. Install the lockfile with `npm ci`; cache npm downloads, not `node_modules`.
3. Run `npm audit --omit=dev`. Runtime advisories fail this gate; the existing
   build-tool advisories are not represented as a clean full audit.
4. Run `npm run check` for strict TypeScript and Vitest.
5. Build the production PWA with `npm run build`.
6. Install Chromium and its Linux dependencies using the locked Playwright CLI.
7. Run `npm run test:e2e -- --max-failures=1`, with desktop and emulated mobile
   profiles, against the real production preview under `/PolySheet/`. Stop at
   the first failure rather than exhausting the job timeout on a broken build.
8. On failure, retain browser traces/screenshots in `browser-failure-evidence`
   for seven days. Files absent because an earlier step failed are ignored.
9. On eligible successful runs, upload **only `dist/`** as `github-pages`.

The deployment job requires the successful verification job and uses that same
artifact, not a second untested build. Only this job receives `pages: write` and
`id-token: write`; verification has only `contents: read`. Deployment uses the
`github-pages` environment and GitHub's short-lived OIDC token. No PAT, Vercel
account, server, cloud database, or project secret is needed.

Official actions are pinned to verified full commit SHAs. Review updates before
changing them. There is no privileged `pull_request_target` or `workflow_run`
handler executing pull-request code. Repeated pull-request runs cancel obsolete
runs. Main runs serialize without interrupting an active publication.

## Enable publication

These files configure the pipeline; they do not create a remote repository,
push a commit, change GitHub settings, or publish anything locally.

1. Use your GitHub repository and enable GitHub Actions if the repository or
   organization currently disables it.
2. Open **Settings → Pages → Build and deployment** and select **GitHub Actions**
   as the source. Pages availability depends on repository visibility and plan.
3. Review, commit and push the project files to `main`. This starts verification
   and publication automatically; configure Pages before that push.
4. To deploy the same revision again, open **Actions → CI and Pages →
   Run workflow**, select **main**, and run it. Subsequent pushes to `main`
   also run verification and publication automatically.
5. Open the URL recorded by the **github-pages** deployment environment.

If publication is not wanted yet, do not run/push `main` until you are ready, or
remove the deployment job and the verified-site upload step. The checks on pull
requests do not publish.

Recommended repository protections:

- Require the **Checks and browser tests** status check before merging to `main`.
- Restrict the **github-pages** environment to `main`; optionally require a
  reviewer for explicit publication approval.
- Keep default workflow permissions read-only. Do not add repository secrets to
  the verification job or bypass failed checks to deploy.

## What CI verifies

CI does not download or distribute third-party game content. Reference checkouts
and generated files in `.reference/` are gitignored and absent from a clean
checkout. Their optional tests explicitly skip until the licensed local inputs
are prepared. A green CI run is not evidence of full external-system support,
live third-party CORS access, or execution of those skipped tests.

The original MIT-licensed Sentieri fixture always exercises JSON import, gzip
`.rpg` import, ability edits, offline reopen, byte-identical binary export and
backup v3 restore. The original capabilities fixture additionally covers typed
photos/lists/references and encounter turns, offline reopening and backup restore.
Other always-on cases cover malformed packages, URL errors, resource links,
dice, persistence, keyboard/mobile layout and size limits.
The deployment-path test checks the actual pathname, manifest start/scope,
service-worker script/scope and offline reload. Local source-preparation and
the separately opted-in live Raw check remain documented in the README.

To reproduce the Pages subdirectory checks without stopping an existing preview:

```powershell
npm run check
npm run build
$env:PLAYWRIGHT_PORT = '4183'
$env:PLAYWRIGHT_BASE_PATH = '/PolySheet/'
npm run test:e2e
```

`PLAYWRIGHT_BASE_PATH` defaults to `/`; safe ASCII path segments must start and
end with `/`. Dot-only segments and shell metacharacters are rejected. Set it
back to `/` to test root hosting. No second build is needed for a different
subdirectory: production URLs and the PWA manifest are relative.

## Data, updates and recovery

Only the static application is published. Local browser databases, imported
systems, saved characters, backups, `.reference/`, and test artifacts are not
part of the Pages site. Ordinary Pages hosting makes the built app public.
GitHub Pages does not let this workflow configure arbitrary response headers.

`localhost` and GitHub Pages have different origins and therefore different
IndexedDB archives. Export a backup from the old origin and explicitly restore
it on the new one if you want to move your data. The pipeline never transfers
that data. A custom-domain change also changes the origin.

After an app update, finish pending input before accepting its update prompt.
A deployment does not silently migrate character source versions.

If verification fails, no Pages deployment runs; the previously published site
remains. Inspect the failing step and download browser evidence if present.
If publication alone fails, check Pages source, environment approvals and
organization permissions, then rerun the workflow on `main`.

For an application regression, revert the relevant commit through normal review
and push `main`; the pipeline verifies the replacement before publishing it.
This does not undo user database changes or replace the need for backups.

## References

- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Configure a Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Executed local verification and remaining limitations](VERIFICATION.md)
