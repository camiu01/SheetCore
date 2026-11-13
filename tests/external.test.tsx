/**
 * @file Pinned external 5e integration. External content never ships with the PWA.
 * @see https://github.com/blastervla/rpg-companion-app-systems/tree/92b8128a1e6da7ed39406012e357d1e3d0e1792b
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { prepareSystem } from '../src/importing/system';
import { createEvaluator } from '../src/engine/formulas';
import { SheetDatabase, createCharacter, installSystem, setCharacterValue } from '../src/persistence/db';
import { RenderView } from '../src/ui/renderer';
import { exportBackup, restoreBackup } from '../src/persistence/backup';
import { externalSlice } from '../src/importing/external-slice';

const path = resolve('.reference/5e.json');
if (process.env.REQUIRE_EXTERNAL && !existsSync(path)) throw new Error('Required external fixture missing');
describe.skipIf(!existsSync(path))('5e 0.5.1 at pinned commit: explicit partial compatibility', () => {
  it('rejects invalid typed constants in the full source without guessing conversions', async () => {
    const full = await prepareSystem(readFileSync(path, 'utf8'), 'pinned external original');
    expect(full.definition.character_stats).toHaveLength(317);
    expect(full.definition.resources).toHaveLength(46);
    expect(full.diagnostics).toContainEqual(expect.objectContaining({
      path: '$.character_stats[46].components.clauses[0].condition.components.components[1]', severity: 'error'
    }));
    const database = new SheetDatabase(`external-invalid-${crypto.randomUUID()}`);
    try {
      await expect(installSystem(full, database)).rejects.toThrow('Correggi');
      expect(await database.systems.count()).toBe(0);
    } finally { await database.delete(); }
  });
  it('imports real definitions, edits six modifiers, renders abilities, persists and restores', async () => {
    const full = await prepareSystem(readFileSync(path, 'utf8'), 'pinned external original');
    const slice = externalSlice(full.definition);
    // Retained objects must be byte-for-byte equivalent after JSON serialization.
    expect(slice.character_stats).toEqual(full.definition.character_stats.filter(s => slice.character_stats.some(t => t.id === s.id)));
    expect(slice.character_sheet_sections[0]).toEqual(full.definition.character_sheet_sections[5]);
    const original = JSON.stringify(slice, null, 2);
    writeFileSync(resolve('.reference/5e-slice.json'), original);
    const imported = await prepareSystem(original, 'Explicit subset of 92b8128a1e6da7ed39406012e357d1e3d0e1792b:systems/5e/system.rpg.json');
    expect(imported.definition.character_stats).toHaveLength(13);
    expect(imported.definition.resources).toHaveLength(1);
    expect(imported.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    expect(imported.diagnostics.some(d => d.message.includes('icon'))).toBe(true);
    expect(imported.diagnostics.some(d => d.path.endsWith('on_tap_event'))).toBe(true);
    const database = new SheetDatabase(`external-${crypto.randomUUID()}`);
    try {
      await installSystem(imported, database);
      const c = await createCharacter(imported, 'Integration traveller', database);
      const engine = createEvaluator(imported.definition.character_stats, c.values);
      for (const id of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'])
        expect(engine.get(`${id}_modifier`)).toBe(-1);
      await setCharacterValue(c.id, 'strength_score', 15, database);
      await setCharacterValue(c.id, 'dexterity_score', 9, database);
      database.close(); await database.open();
      const reopened = await database.characters.get(c.id);
      expect(reopened).toBeDefined();
      const next = createEvaluator(imported.definition.character_stats, reopened!.values);
      expect(next.get('strength_modifier')).toBe(2);
      expect(next.get('dexterity_modifier')).toBe(-1);
      const abilities = imported.definition.character_sheet_sections.find(s => s.id === 'abilities')!;
      render(<RenderView input={abilities.view} context={{ stats: imported.definition.character_stats, values: reopened!.values }} />);
      expect(screen.getByText('Ability Modifiers')).toBeInTheDocument();
      expect(screen.getByTestId('stat-strength_modifier')).toHaveTextContent('2');
      expect(screen.getByTestId('stat-dexterity_modifier')).toHaveTextContent('-1');
      expect(screen.getAllByText('Non supportato: on_tap_event')).toHaveLength(6);
      const note = imported.definition.resources.find(r => r.id === 'note')!;
      expect(createEvaluator(note.stats).get('display_title')).toBe('Untitled note');
      expect(createEvaluator(note.stats, { title: 'North pass' }).get('display_title')).toBe('North pass');
      const backup = await exportBackup(database);
      await restoreBackup(backup, database);
      expect((await database.characters.get(c.id))?.values.strength_score).toBe(15);
    } finally { await database.delete(); }
  });
});
