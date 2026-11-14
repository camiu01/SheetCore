// @vitest-environment node
/** @file Public GitHub contract fixtures; no credentials, clones or remote writes. */
import { gzipSync } from 'node:zlib';
import { afterEach, expect, it, vi } from 'vitest';
import { discoverGithub, githubRepository, importGithubFile, MAX_TREE_ENTRIES } from '../src/importing/github';
import { artifactBytes } from '../src/importing/package';
import { importFromUrl } from '../src/importing/url';
import { MAX_SYSTEM_BYTES } from '../src/importing/system';
import { demoOriginal } from '../src/demo';
import { SheetDatabase, createCharacter, installSystem } from '../src/persistence/db';
import { exportBackup, restoreBackup } from '../src/persistence/backup';

const repository = 'https://github.com/owner/repo';
const commit = '1'.repeat(40), treeSha = '2'.repeat(40);
const bytes = Uint8Array.from(gzipSync('\ufeff' + demoOriginal));
const entry = (path = '5e/system.rpg') => ({ path, type: 'blob', mode: '100644', size: bytes.length });
const commits = [{ sha: commit, commit: { tree: { sha: treeSha } } }];
const tree = (entries: unknown[] = [entry()]) => ({ sha: treeSha, truncated: false, tree: entries });
function stubTree(value: unknown = tree()) {
  const fetch = vi.fn(async (url: URL) => {
    if (url.hostname === 'raw.githubusercontent.com') return new Response(bytes);
    return Response.json(url.pathname.endsWith('/commits') ? commits : value);
  });
  vi.stubGlobal('fetch', fetch); return fetch;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('normalizes GitHub root clone links without using a Git client', () => {
  for (const url of [
    repository, repository + '.git/', repository + '?tab=readme#readme',
    'git@github.com:owner/repo.git', 'ssh://git@github.com/owner/repo.git',
    'git://github.com/owner/repo.git', 'https://www.github.com/owner/repo.git'
  ]) expect(githubRepository(url)).toBe(repository);
  for (const url of ['https://github.com.evil.test/owner/repo.git', 'http://github.com/owner/repo', 'https://gitlab.com/owner/repo.git', 'not a URL'])
    expect(githubRepository(url)).toBeNull();
  for (const url of ['https://token@github.com/owner/repo', 'ssh://git:secret@github.com/owner/repo', repository + '/tree/main', 'https://github.com/owner/..git', repository + ':443'])
    expect(() => githubRepository(url)).toThrow();
});

it('discovers only conventional regular system files and pins the default-branch commit', async () => {
  const fetch = stubTree(tree([entry('z/system.json'), entry(), entry('systems.rpg'), entry('resources.rpg'),
    entry('system.rpgs'), { ...entry('system.rpg'), mode: '120000' }, { ...entry('submodule'), type: 'commit' }]));
  const snapshot = await discoverGithub(repository + '.git');
  expect(snapshot).toEqual({ repository, commit, files: [{ path: '5e/system.rpg', size: bytes.length }, { path: 'z/system.json', size: bytes.length }] });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][0].href).toBe('https://api.github.com/repos/owner/repo/commits?per_page=1');
  expect(fetch.mock.calls[1][0].href).toBe(`https://api.github.com/repos/owner/repo/git/trees/${treeSha}?recursive=1`);
  for (const call of fetch.mock.calls) expect(call[0].hostname).toBe('api.github.com');
});

it('sends an explicit ref as an encoded query and downloads only the selected immutable file', async () => {
  const fetch = stubTree();
  const snapshot = await discoverGithub(repository, 'feature/a b');
  expect(fetch.mock.calls[0][0].searchParams.get('sha')).toBe('feature/a b');
  const imported = await importGithubFile(snapshot, '5e/system.rpg');
  expect(imported.source).toBe(`https://raw.githubusercontent.com/owner/repo/${commit}/5e/system.rpg`);
  expect(imported.original).toBe('\ufeff' + demoOriginal);
  expect(artifactBytes(imported.artifact!.base64)).toEqual(bytes);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch).toHaveBeenLastCalledWith(expect.any(URL), expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal) }));
});

it('rejects incomplete, unsafe, oversized or inconsistent trees instead of showing partial results', async () => {
  for (const value of [
    { ...tree(), truncated: true }, { ...tree(), truncated: null }, { ...tree(), sha: 'bad' },
    tree([entry(), entry()]), tree([entry('../system.rpg')]), tree([entry('/system.rpg')]),
    tree([entry('a\\system.rpg')]), tree([{ ...entry(), size: -1 }]),
    tree([{ ...entry(), size: MAX_SYSTEM_BYTES + 1 }]), tree([{ ...entry(), size: 1.5 }]),
    tree(Array.from({ length: 101 }, (_, i) => entry(`${i}/system.json`))),
    tree(Array.from({ length: MAX_TREE_ENTRIES + 1 }, () => ({ type: 'tree' })))
  ]) { stubTree(value); await expect(discoverGithub(repository)).rejects.toThrow(); }
});

it('accepts the declared file-size boundary without downloading it during discovery', async () => {
  const fetch = stubTree(tree([{ ...entry(), size: MAX_SYSTEM_BYTES }]));
  expect((await discoverGithub(repository)).files[0].size).toBe(MAX_SYSTEM_BYTES);
  expect(fetch).toHaveBeenCalledTimes(2);
  const entries: unknown[] = Array.from({ length: 100 }, (_, i) => entry(`${i}/system.rpg`));
  entries.push(...Array.from({ length: MAX_TREE_ENTRIES - 100 }, () => ({ type: 'tree' })));
  stubTree(tree(entries));
  expect((await discoverGithub(repository)).files).toHaveLength(100);
});

it('discovers nested system files in a large repository tree beyond ten thousand entries', async () => {
  const nested = (path: string) => entry(path);
  const entries: unknown[] = [nested('systems/5e/system/system.rpg.json'),
    nested('systems/pf2e/system/system.rpg.json'), nested('systems/5e2024/system/system.rpg.json')];
  entries.push(...Array.from({ length: 10574 }, () => ({ type: 'tree' })));
  stubTree(tree(entries));
  const snapshot = await discoverGithub('https://github.com/blastervla/rpg-companion-app-systems');
  expect(snapshot.files.map(file => file.path)).toEqual([
    'systems/5e/system/system.rpg.json', 'systems/5e2024/system/system.rpg.json',
    'systems/pf2e/system/system.rpg.json'
  ]);
});

it('reports authoring-only repositories and does not compile split sources', async () => {
  stubTree(tree([entry('systems/5e/character_stats.rpgs'), entry('systems/5e/resources/note/index.rpg.json')]));
  await expect(discoverGithub(repository)).rejects.toThrow('Nessun system.rpg');
  stubTree(tree([entry('system.rpg.json')]));
  const snapshot = await discoverGithub(repository);
  const split = JSON.stringify({ id: 'split-root-only' });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(split)));
  await expect(importGithubFile({ ...snapshot, files: [{ path: 'system.rpg.json', size: new TextEncoder().encode(split).length }] }, 'system.rpg.json')).rejects.toThrow('Invalid input');
  const authoring = JSON.stringify({
    id: '5e', name: '5e', version: '0.9.1', min_app_version: '1.2.0', character_indexed_stats: ['name'],
    live_session_enabled: true, progression_systems: {}, currencies: {}
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(authoring)));
  await expect(importGithubFile({ ...snapshot, files: [{ path: 'system.rpg.json', size: new TextEncoder().encode(authoring).length }] }, 'system.rpg.json'))
    .rejects.toThrow('sorgente di authoring suddivisa');
});

it('rejects an empty or malformed commit response and invalid refs before tree traversal', async () => {
  for (const value of [[], {}, [{ sha: 'main', commit: { tree: { sha: treeSha } } }]]) {
    const fetch = vi.fn(async () => Response.json(value)); vi.stubGlobal('fetch', fetch);
    await expect(discoverGithub(repository)).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(1);
  }
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(discoverGithub(repository, 'a'.repeat(201))).rejects.toThrow();
  await expect(discoverGithub(repository, 'a\nb')).rejects.toThrow();
  await expect(discoverGithub('https://gitlab.com/owner/repo.git')).rejects.toThrow('solo per repository GitHub');
  await expect(importFromUrl('https://gitlab.com/owner/repo.git')).rejects.toThrow('solo per repository GitHub');
  expect(fetch).not.toHaveBeenCalled();
});

it('distinguishes rate limits, private/missing repositories and empty repositories', async () => {
  for (const [status, message] of [[429, 'Limite di richieste'], [404, 'non trovato o non pubblico'], [409, 'Repository vuoto'], [500, 'HTTP 500']] as const) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status })));
    await expect(discoverGithub(repository)).rejects.toThrow(message);
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })));
  await expect(discoverGithub(repository)).rejects.toThrow('Limite di richieste');
});

it('bounds API payloads and preserves timeout, CORS and malformed-JSON errors', async () => {
  for (const response of [new Response('{}', { headers: { 'content-length': String(MAX_SYSTEM_BYTES + 1) } }), new Response(new Uint8Array(MAX_SYSTEM_BYTES + 1))]) {
    vi.stubGlobal('fetch', vi.fn(async () => response));
    await expect(discoverGithub(repository)).rejects.toThrow('troppo grande');
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{bad')));
  await expect(discoverGithub(repository)).rejects.toThrow('JSON malformato');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network'); }));
  await expect(discoverGithub(repository)).rejects.toThrow('CORS');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('Timeout', 'TimeoutError'); }));
  await expect(discoverGithub(repository)).rejects.toThrow('15 secondi');
});

it('rejects unlisted paths before fetching and inconsistent downloaded sizes before preview', async () => {
  const fetch = stubTree(), snapshot = await discoverGithub(repository);
  fetch.mockClear();
  await expect(importGithubFile(snapshot, '../system.rpg')).rejects.toThrow();
  await expect(importGithubFile(snapshot, 'other/system.rpg')).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('wrong bytes')));
  await expect(importGithubFile(snapshot, '5e/system.rpg')).rejects.toThrow('Dimensione del file diversa');
});

it('preserves repository originals, immutable character pins and provenance through backup restoration', async () => {
  stubTree();
  const imported = await importGithubFile(await discoverGithub(repository), '5e/system.rpg');
  const database = new SheetDatabase(`github-${crypto.randomUUID()}`);
  try {
    expect(await database.systems.count()).toBe(0);
    await installSystem(imported, database);
    const character = await createCharacter(imported, 'Local fixture', database);
    const backup = await exportBackup(database);
    await restoreBackup(backup, database);
    const restored = await database.systems.get(imported.key);
    expect(restored?.source).toBe(imported.source);
    expect(restored?.original).toBe('\ufeff' + demoOriginal);
    expect(artifactBytes(restored!.artifact!.base64)).toEqual(bytes);
    expect((await database.characters.get(character.id))?.systemKey).toBe(imported.key);
  } finally { await database.delete(); }
});
