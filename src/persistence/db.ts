/** @file Versioned local database and transaction-safe character operations. */
import Dexie, { type EntityTable } from 'dexie';
import { jsonValue, matchesType, type Character, type Combat, type Preferences, type ResourceInstance, type Roll, type Stat, type StoredSystem } from '../domain/model';
import { checkReferences, referencedIds } from '../domain/references';

/** Schema v3 adds encounters; legacy upgrades preserve every value and system pin. */
export class SheetDatabase extends Dexie {
  systems!: EntityTable<StoredSystem, 'key'>;
  characters!: EntityTable<Character, 'id'>;
  resources!: EntityTable<ResourceInstance, 'id'>;
  rolls!: EntityTable<Roll, 'id'>;
  preferences!: EntityTable<Preferences, 'id'>;
  combats!: EntityTable<Combat, 'id'>;
  // Storage name is a stable identifier: keeping the original keeps existing local data reachable.
  constructor(name = 'sheetcore') {
    super(name);
    this.version(1).stores({
      systems: 'key, definition.id', characters: 'id, systemKey, updatedAt',
      resources: 'id, systemKey, definitionId', rolls: 'id, systemKey, createdAt',
      preferences: 'id'
    });
    this.version(2).stores({ characters: 'id, systemKey, updatedAt' }).upgrade(async transaction => {
      await transaction.table('characters').toCollection().modify(character => {
        character.revision ??= 0;
        character.resourceIds ??= [];
      });
    });
    this.version(3).stores({ combats: 'id, systemKey, updatedAt' });
  }
}
export const db = new SheetDatabase();
export const defaultPreferences: Preferences = { id: 'app', theme: 'light', historyLimit: 100 };
/** Clone base defaults only; calculated stats always remain definitions. */
export function initialValues(stats: Stat[]) {
  return Object.fromEntries(stats.filter(s => s.type === 'base').map(s => [s.id, jsonValue(s.default_value)]));
}
/** Install an immutable version idempotently; block diagnosed errors. */
export async function installSystem(system: StoredSystem, database = db) {
  if (system.diagnostics.some(d => d.severity === 'error')) throw new Error('Correggi gli errori strutturali o semantici prima di importare.');
  await database.transaction('rw', database.systems, async () => {
    const existing = await database.systems.get(system.key);
    if (existing) return;
    await database.systems.add(system);
  });
}
/** Create a manual character. Official creation-page effects are never invoked. */
export async function createCharacter(system: StoredSystem, name: string, database = db) {
  if (!name.trim() || name.length > 100) throw new Error('Inserisci un nome da 1 a 100 caratteri.');
  const values = initialValues(system.definition.character_stats);
  const nameId = system.definition.character_display_name ?? 'name';
  const nameStat = system.definition.character_stats.find(s => s.id === nameId);
  if (nameStat?.type === 'base' && nameStat.value_type === 'string') values[nameId] = name.trim();
  const now = new Date().toISOString();
  const character: Character = {
    id: crypto.randomUUID(), systemKey: system.key, name: name.trim(), values,
    resourceIds: [], createdAt: now, updatedAt: now, revision: 0
  };
  await database.characters.add(character);
  return character;
}
/**
 * Patch one base field against the latest persisted record inside a transaction.
 * @remarks Concurrent edits to distinct fields cannot overwrite a stale snapshot.
 */
export async function setCharacterValue(id: string, statId: string, value: unknown, database = db) {
  await database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    const c = await database.characters.get(id);
    if (!c) throw new Error('Personaggio non trovato');
    const system = await database.systems.get(c.systemKey);
    const s = system?.definition.character_stats.find(s => s.id === statId);
    if (!s || s.type !== 'base' || !matchesType(value, s.value_type, s.sub_value_type)) throw new Error(`${statId}: valore non modificabile o non valido`);
    const ids = referencedIds(s, value);
    if (ids.length) {
      const records = (await database.resources.bulkGet(ids)).filter((r): r is ResourceInstance => !!r);
      checkReferences([s], { [statId]: value }, records, c.systemKey);
    }
    c.values[statId] = jsonValue(value);
    if (statId === (system?.definition.character_display_name ?? 'name') && typeof value === 'string') c.name = value || 'Senza nome';
    c.updatedAt = new Date().toISOString(); c.revision++;
    await database.characters.put(c);
  });
}
/** Link local notebook metadata; require the exact same immutable system import. */
export async function attachResource(characterId: string, resourceId: string, database = db) {
  await database.transaction('rw', database.characters, database.resources, async () => {
    const c = await database.characters.get(characterId), r = await database.resources.get(resourceId);
    if (!c || !r || c.systemKey !== r.systemKey) throw new Error('Personaggio e risorsa devono usare la stessa versione del sistema.');
    c.resourceIds = [...new Set([...c.resourceIds, resourceId])]; c.revision++;
    c.updatedAt = new Date().toISOString();
    await database.characters.put(c);
  });
}
/** Remove a notebook link without deleting the underlying resource. */
export async function detachResource(characterId: string, resourceId: string, database = db) {
  await database.transaction('rw', database.characters, async () => {
    const c = await database.characters.get(characterId);
    if (!c) throw new Error('Personaggio non trovato');
    c.resourceIds = c.resourceIds.filter(id => id !== resourceId); c.revision++;
    c.updatedAt = new Date().toISOString();
    await database.characters.put(c);
  });
}
/** Save one roll and trim the global history atomically to the configured limit. */
export async function saveRoll(roll: Roll, limit: number, database = db) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Limite storico non valido');
  await database.transaction('rw', database.rolls, async () => {
    await database.rolls.add(roll);
    const ordered = await database.rolls.orderBy('createdAt').reverse().primaryKeys();
    await database.rolls.bulkDelete(ordered.slice(limit));
  });
}
