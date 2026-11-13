/**
 * Extract only the observed gzip-JSON system payload from the supplied Archer repo.
 * This is a local inspection adapter for one pinned artifact, NOT a general .rpg decoder.
 * No content from this repository is distributed. Its license has not been established.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const repo = resolve('.reference/Archer-class');
const pinned = '378bdf68f055bae8777a233fc0ac6e4f9eb6145c';
const bytes = execFileSync('git', ['-C', repo, 'show', `${pinned}:5e/system.rpg`], { maxBuffer: 8 * 1024 * 1024 });
if (bytes.length > 8 * 1024 * 1024 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error('Unexpected artifact envelope');
const json = gunzipSync(bytes, { maxOutputLength: 8 * 1024 * 1024 });
const data = JSON.parse(json.toString('utf8'));
if (data.id !== '5e' || data.version !== '0.9.1' || data.character_stats?.length !== 317) throw new Error('Pinned artifact payload changed');
writeFileSync(resolve('.reference/archer-system.json'), json);
console.log('Local-only extracted JSON: .reference/archer-system.json; source 5e/system.rpg at ' + pinned);
