/** @file Transaction, migration and backup integration tests using fake-indexeddb. */
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SheetDatabase, attachResource, createCharacter, initialValues, installSystem, saveRoll, setCharacterValue } from '../src/persistence/db';
import { exportBackup, restoreBackup, validateBackup } from '../src/persistence/backup';
import { demoOriginal } from '../src/demo';
import { prepareSystem } from '../src/importing/system';

let database: SheetDatabase;
beforeEach(() => { database = new SheetDatabase(`test-${crypto.randomUUID()}`); });
afterEach(async () => { await database.delete(); });
async function setup() {
  const system = await prepareSystem(demoOriginal, 'original fixture MIT');
  await installSystem(system, database);
  const c = await createCharacter(system, 'Ada', database);
  return { system, c };
}
describe('local persistence', () => {
  it('creates, edits and reopens a character without persisting derived values', async () => {
    const { c } = await setup();
    await setCharacterValue(c.id, 'vigore', 7, database);
    database.close(); await database.open();
    expect((await database.characters.get(c.id))?.values.vigore).toBe(7);
    expect((await database.characters.get(c.id))?.values).not.toHaveProperty('slancio');
    await expect(setCharacterValue(c.id, 'slancio', 999, database)).rejects.toThrow();
  });
  it('does not lose overlapping edits to different fields', async () => {
    const { c } = await setup();
    await Promise.all([setCharacterValue(c.id, 'vigore', 5, database), setCharacterValue(c.id, 'ingegno', 8, database)]);
    expect((await database.characters.get(c.id))?.values).toMatchObject({ vigore: 5, ingegno: 8 });
    expect((await database.characters.get(c.id))?.revision).toBe(2);
  });
  it('keeps characters pinned when a different source with the same version is imported', async () => {
    const { system, c } = await setup();
    const second = await prepareSystem(demoOriginal + '\n', 'alternate source');
    await installSystem(second, database); await installSystem(system, database);
    expect(await database.systems.count()).toBe(2);
    expect((await database.characters.get(c.id))?.systemKey).toBe(system.key);
  });
  it('links resources idempotently and refuses cross-version links', async () => {
    const { system, c } = await setup();
    const def = system.definition.resources[0];
    await database.resources.add({ id: 'r', definitionId: def.id, systemKey: system.key, name: 'Map', values: initialValues(def.stats) });
    await attachResource(c.id, 'r', database); await attachResource(c.id, 'r', database);
    expect((await database.characters.get(c.id))?.resourceIds).toEqual(['r']);
    await database.resources.update('r', { systemKey: 'other-version' });
    await expect(attachResource(c.id, 'r', database)).rejects.toThrow('stessa versione');
  });
  it('trims roll history at the configured worst-case boundary', async () => {
    const { system } = await setup();
    for (let i = 0; i < 5; i++) await saveRoll({ id: String(i), systemKey: system.key, formula: '1d6', results: [1], total: 1, createdAt: new Date(i * 1000).toISOString() }, 3, database);
    expect(await database.rolls.orderBy('createdAt').primaryKeys()).toEqual(['2', '3', '4']);
  });
  it('upgrades an actual v1 database without losing values', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({ systems: 'key, definition.id', characters: 'id, systemKey, updatedAt', resources: 'id, systemKey, definitionId', rolls: 'id, systemKey, createdAt', preferences: 'id' });
    await old.table('characters').add({ id: 'old', systemKey: 'pinned', values: { vigore: 4 }, updatedAt: '2020-01-01' });
    old.close();
    const migrated = new SheetDatabase(name);
    try {
      const c = await migrated.characters.get('old');
      expect(c?.values).toEqual({ vigore: 4 });
      expect(c?.revision).toBe(0); expect(c?.resourceIds).toEqual([]);
    } finally { await migrated.delete(); }
  });
});
describe('backup v2 and legacy v1', () => {
  it('round-trips every table and the exact original system document', async () => {
    const { system, c } = await setup();
    const r = { id: 'r', systemKey: system.key, definitionId: 'ricordo', name: 'Mappa', values: { titolo: 'Il passo', testo: 'Verso nord' } };
    await database.resources.add(r); await attachResource(c.id, 'r', database);
    await database.preferences.put({ id: 'app', theme: 'dark', historyLimit: 33 });
    await saveRoll({ id: 'roll', systemKey: system.key, formula: '1d6', results: [4], total: 4, createdAt: new Date().toISOString() }, 33, database);
    const backup = await exportBackup(database);
    const before = JSON.parse(backup);
    await restoreBackup(backup, database);
    const after = JSON.parse(await exportBackup(database));
    delete before.exportedAt; delete after.exportedAt;
    expect(after).toEqual(before);
    expect((await database.systems.get(system.key))?.original).toBe(demoOriginal);
  });
  it('validates before modifying any existing data', async () => {
    const { c } = await setup();
    const original = JSON.parse(await exportBackup(database));
    original.characters[0].systemKey = 'missing';
    await expect(restoreBackup(JSON.stringify(original), database)).rejects.toThrow('Sistema mancante');
    expect((await database.characters.get(c.id))?.name).toBe('Ada');
    expect(await database.systems.count()).toBe(1);
  });
  it('rejects unsupported versions, source tampering, duplicates and dangling links', async () => {
    await setup(); const text = await exportBackup(database); const original = JSON.parse(text);
    await expect(validateBackup(JSON.stringify({ ...original, version: 4 }))).rejects.toThrow();
    const tampered = structuredClone(original); tampered.systems[0].original += '\n';
    await expect(validateBackup(JSON.stringify(tampered))).rejects.toThrow('alterato');
    const duplicates = structuredClone(original); duplicates.characters.push(duplicates.characters[0]);
    await expect(validateBackup(JSON.stringify(duplicates))).rejects.toThrow('duplicati');
    const dangling = structuredClone(original); dangling.characters[0].resourceIds = ['missing'];
    await expect(validateBackup(JSON.stringify(dangling))).rejects.toThrow('Risorsa assegnata');
  });
});
