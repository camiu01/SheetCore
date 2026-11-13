/** @file Validated resource writes and referentially safe deletion. */
import { matchesType, type ResourceInstance } from '../domain/model';
import { checkReferences, referencedIds } from '../domain/references';
import { db } from './db';

/** Save a manual resource with bounded typed values and same-version links. */
export async function saveResource(record: ResourceInstance, database = db) {
  await database.transaction('rw', database.resources, database.systems, async () => {
    const system = await database.systems.get(record.systemKey);
    const definition = system?.definition.resources.find(d => d.id === record.definitionId);
    if (!definition || !record.name.trim() || record.name.length > 100) throw new Error('Nome o definizione risorsa non validi.');
    const existing = await database.resources.get(record.id);
    if (existing && (existing.systemKey !== record.systemKey || existing.definitionId !== record.definitionId))
      throw new Error('Tipo e versione di una risorsa esistente non possono cambiare.');
    for (const [id, value] of Object.entries(record.values)) {
      const stat = definition.stats.find(s => s.id === id && s.type === 'base');
      if (!stat || !matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error(`${id}: valore risorsa non valido.`);
    }
    const resources = await database.resources.where('systemKey').equals(record.systemKey).toArray();
    checkReferences(definition.stats, record.values, [...resources.filter(r => r.id !== record.id), record], record.systemKey);
    await database.resources.put(record);
  });
}
/** Do not leave dangling rule references or combat sources when deleting a note. */
export async function deleteResource(id: string, database = db) {
  await database.transaction('rw', [database.resources, database.characters, database.systems, database.combats], async () => {
    const record = await database.resources.get(id);
    if (!record) return;
    const system = await database.systems.get(record.systemKey);
    const characters = await database.characters.where('systemKey').equals(record.systemKey).toArray();
    const resources = await database.resources.where('systemKey').equals(record.systemKey).toArray();
    if (!system) throw new Error('Sistema della risorsa mancante.');
    const linked = (stats: typeof system.definition.character_stats, values: Record<string, unknown>) =>
      stats.some(s => referencedIds(s, values[s.id]).includes(id));
    if (characters.some(c => linked(system.definition.character_stats, c.values))
      || resources.some(r => r.id !== id && linked(system.definition.resources.find(d => d.id === r.definitionId)?.stats ?? [], r.values))
      || (await database.combats.where('systemKey').equals(record.systemKey).toArray()).some(c =>
        c.combatants.some(f => {
          const type = system.definition.combat_system?.combatant_types.find(t => t.id === f.typeId);
          const stats = system.definition.resources.find(d => d.id === type?.instance_resource_id)?.stats ?? [];
          return f.resourceId === id || f.templateId === id || linked(stats, { ...f.values, ...f.overrides });
        })))
      throw new Error('Risorsa usata da un campo o da un incontro: rimuovi prima il riferimento.');
    await database.resources.delete(id);
    for (const c of characters.filter(c => c.resourceIds.includes(id))) {
      c.resourceIds = c.resourceIds.filter(value => value !== id);
      c.revision++; c.updatedAt = new Date().toISOString();
      await database.characters.put(c);
    }
  });
}
