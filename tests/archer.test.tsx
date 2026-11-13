/**
 * @file Additional user-provided, compiled-artifact evidence.
 * @remarks No license was found. The payload stays local and the test skips without it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareSystem } from '../src/importing/system';
import { createEvaluator } from '../src/engine/formulas';
import { SheetDatabase, createCharacter, installSystem, setCharacterValue } from '../src/persistence/db';
const path = resolve('.reference/archer-system.json');
describe.skipIf(!existsSync(path))('user-provided Archer 5e 0.9.1 extracted JSON', () => {
  it('recognizes the observed nullable serialization and retains unsupported rules', async () => {
    const imported = await prepareSystem(readFileSync(path, 'utf8'), 'Archer-class@378bdf68f055bae8777a233fc0ac6e4f9eb6145c:5e/system.rpg (observed gzip JSON only)');
    expect(imported.definition.character_stats).toHaveLength(317);
    expect(imported.definition.resources).toHaveLength(50);
    expect(imported.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(imported.definition.dice?.map(d => d.faces)).toEqual([4, 6, 8, 10, 12, 20]);
    expect(imported.diagnostics.some(d => d.path === '$.mechanics')).toBe(true);
    const engine = createEvaluator(imported.definition.character_stats, { strength_score: 15 });
    expect(engine.get('strength_modifier')).toBe(2);
    const database = new SheetDatabase(`archer-${crypto.randomUUID()}`);
    try {
      await installSystem(imported, database);
      const character = await createCharacter(imported, 'Archer JSON inspection', database);
      expect(createEvaluator(imported.definition.character_stats, character.values).get('strength_modifier')).toBe(-1);
      await setCharacterValue(character.id, 'strength_score', 15, database);
      database.close(); await database.open();
      expect((await database.characters.get(character.id))?.values.strength_score).toBe(15);
    } finally { await database.delete(); }
  });
});
