/**
 * Prepare exact, local-only Git blobs for verified compiled-system tests.
 * No external content or tool implementation is distributed with this script.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const fixtures = [
  { name: 'archer', repo: '.reference/Archer-class', commit: '378bdf68f055bae8777a233fc0ac6e4f9eb6145c', version: '0.9.1' },
  { name: 'derpsy', repo: '.reference/derpsy-books', commit: '00f55b2c3023c59f5857297dc933a7505c9b6aa4', version: '0.6.0' }
];
const requested = process.argv[2];
if (requested && !fixtures.some(f => f.name === requested)) throw new Error('Expected archer or derpsy');
mkdirSync(resolve('.reference'), { recursive: true });
for (const f of fixtures.filter(f => !requested || f.name === requested)) {
  const bytes = execFileSync('git', ['-C', resolve(f.repo), 'show', `${f.commit}:5e/system.rpg`], { maxBuffer: 8 * 1024 * 1024 });
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error('Unexpected gzip envelope');
  const json = gunzipSync(bytes, { maxOutputLength: 8 * 1024 * 1024 });
  const source = JSON.parse(json.toString('utf8'));
  if (source.id !== '5e' || source.version !== f.version || source.character_stats?.length !== 317 || source.resources?.length !== 50)
    throw new Error('Pinned source metadata changed');
  const output = resolve(`.reference/${f.name}-system.rpg`);
  writeFileSync(output, bytes);
  console.log(JSON.stringify({ file: output, source: `${f.commit}:5e/system.rpg`, compressedBytes: bytes.length, decodedBytes: json.length, version: f.version }));
}
