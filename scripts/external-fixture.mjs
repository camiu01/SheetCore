/**
 * Export an exact historical source blob for local, non-distributed integration tests.
 * No compiler, merge implementation, or third-party content is copied into src/public.
 * @see ../docs/COMPATIBILITY.md
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const commit = '92b8128a1e6da7ed39406012e357d1e3d0e1792b';
const repo = resolve(process.env.RPG_SYSTEMS_REPO ?? '.reference/rpg-companion-app-systems');
const output = resolve('.reference/5e.json');
const text = execFileSync('git', ['-C', repo, 'show', `${commit}:systems/5e/system.rpg.json`], { maxBuffer: 8 * 1024 * 1024 });
mkdirSync(resolve('.reference'), { recursive: true });
if (!existsSync(output) || !readFileSync(output).equals(text)) writeFileSync(output, text);
console.log(`External, unmodified fixture: ${commit}:systems/5e/system.rpg.json`);
if (process.argv.includes('--test')) {
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/external.test.tsx'], {
    stdio: 'inherit', env: { ...process.env, REQUIRE_EXTERNAL: '1' }
  });
  process.exit(result.status ?? 1);
}
