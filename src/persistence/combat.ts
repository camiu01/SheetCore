/** @file Atomic encounter commands. Reloading a record never reruns on_create. */
import { jsonValue, matchesType, type Combat, type Combatant } from '../domain/model';
import { checkReferences } from '../domain/references';
import { advanceCombat, combatContext, eligibleCombatants, initializeCombatant, initiativeOrder, rollInitiatives } from '../engine/combat';
import { db, initialValues } from './db';

export type CombatCommand =
  | { type: 'add'; typeId: string; sourceId?: string }
  | { type: 'remove'; id: string }
  | { type: 'value'; id: string; statId: string; value: unknown }
  | { type: 'initiative'; id: string; value: number }
  | { type: 'difficulty'; value: string | null }
  | { type: 'roll' | 'start' | 'next' | 'finish' };

/** Create an empty encounter pinned to the selected immutable system version. */
export async function createCombat(systemKey: string, name: string, database = db) {
  const system = await database.systems.get(systemKey);
  if (!system?.definition.combat_system || !name.trim() || name.length > 100) throw new Error('Nome o sistema incontro non valido.');
  const now = new Date().toISOString();
  const combat: Combat = {
    id: crypto.randomUUID(), systemKey, name: name.trim(),
    difficulty: system.definition.combat_system.difficulty_levels?.[0]?.id ?? null,
    status: 'preparing', round: 0, pass: 1, turn: 0, revision: 0,
    combatants: [], createdAt: now, updatedAt: now
  };
  await database.combats.add(combat); return combat;
}
/** Re-read all affected records and commit the entire command or none of it. */
export async function commandCombat(id: string, command: CombatCommand, database = db, random?: (faces: number) => number) {
  await database.transaction('rw', [database.combats, database.systems, database.characters, database.resources], async () => {
    const combat = await database.combats.get(id);
    const system = combat ? await database.systems.get(combat.systemKey) : undefined;
    if (!combat || !system?.definition.combat_system) throw new Error('Incontro o sistema non trovato.');
    const definition = system.definition.combat_system;
    const characters = await database.characters.where('systemKey').equals(system.key).toArray();
    const resources = await database.resources.where('systemKey').equals(system.key).toArray();
    if (command.type === 'add') {
      if (combat.status === 'active' || combat.combatants.length >= 100) throw new Error('Aggiungi combattenti prima di avviare l’incontro (massimo 100).');
      const type = definition.combatant_types.find(t => t.id === command.typeId);
      if (!type) throw new Error('Tipo combattente non valido.');
      const fighter: Combatant = {
        id: crypto.randomUUID(), typeId: type.id, values: {}, overrides: {},
        initiative: null, tieBreakers: [], createdAt: new Date().toISOString()
      };
      if (type.template_resource_id === 'character') {
        if (type.instance_resource_id || !characters.some(c => c.id === command.sourceId)) throw new Error('Personaggio non compatibile.');
        if (combat.combatants.some(f => f.characterId === command.sourceId)) throw new Error('Personaggio già presente nell’incontro.');
        fighter.characterId = command.sourceId;
      } else if (type.template_resource_id) {
        const source = resources.find(r => r.id === command.sourceId && r.definitionId === type.template_resource_id);
        if (!source) throw new Error('Risorsa di partenza non compatibile.');
        if (type.instance_resource_id) fighter.templateId = source.id; else fighter.resourceId = source.id;
      } else if (!type.instance_resource_id) throw new Error('Il combattente non definisce una sorgente né un’istanza.');
      if (type.instance_resource_id) {
        const instance = system.definition.resources.find(r => r.id === type.instance_resource_id);
        if (!instance) throw new Error('Tipo istanza mancante.');
        fighter.values = initialValues(instance.stats);
      }
      combat.combatants.push(fighter);
      initializeCombatant(system, combat, fighter.id, characters, resources, random);
      combat.status = 'preparing'; combat.turn = 0;
    } else if (command.type === 'remove') {
      if (combat.status === 'active') throw new Error('Non rimuovere un combattente durante il suo ordine attivo: archivia o prepara prima l’incontro.');
      combat.combatants = combat.combatants.filter(f => f.id !== command.id); combat.turn = 0;
    } else if (command.type === 'value') {
      const fighter = combat.combatants.find(f => f.id === command.id);
      const context = combatContext(system, combat, characters, resources);
      const scope = context.scopes.get(command.id);
      const stat = scope?.stats.find(s => s.id === command.statId && s.type === 'base');
      if (!fighter || !stat || !matchesType(command.value, stat.value_type, stat.sub_value_type)) throw new Error('Valore combattente non modificabile o non valido.');
      checkReferences([stat], { [stat.id]: command.value }, resources, system.key);
      if (fighter.characterId) {
        const character = characters.find(c => c.id === fighter.characterId)!;
        character.values[stat.id] = jsonValue(command.value);
        if (stat.id === (system.definition.character_display_name ?? 'name') && typeof command.value === 'string') character.name = command.value || 'Senza nome';
        character.revision++; character.updatedAt = new Date().toISOString();
        await database.characters.put(character);
      } else if (fighter.resourceId) {
        const resource = resources.find(r => r.id === fighter.resourceId)!;
        resource.values[stat.id] = jsonValue(command.value);
        await database.resources.put(resource);
      } else if (Object.hasOwn(fighter.overrides, stat.id)) fighter.overrides[stat.id] = jsonValue(command.value);
      else fighter.values[stat.id] = jsonValue(command.value);
    } else if (command.type === 'initiative') {
      const fighter = combat.combatants.find(f => f.id === command.id);
      if (!fighter || combat.status === 'active' || !Number.isSafeInteger(command.value) || Math.abs(command.value) > 1000000000) throw new Error('Iniziativa non modificabile o non valida.');
      fighter.initiative = command.value;
      combat.combatants = initiativeOrder(combat).order;
    } else if (command.type === 'difficulty') {
      if (command.value !== null && !definition.difficulty_levels?.some(d => d.id === command.value)) throw new Error('Difficoltà non valida.');
      combat.difficulty = command.value;
    } else if (command.type === 'roll') {
      if (!combat.combatants.length || combat.status === 'active') throw new Error('Tira iniziativa prima di avviare l’incontro.');
      rollInitiatives(system, combat, characters, resources, random); combat.turn = 0; combat.status = 'preparing';
    } else if (command.type === 'start') {
      if (combat.status === 'active' || !combat.combatants.length || initiativeOrder(combat).unresolved) throw new Error('Iniziativa mancante, attiva o parità non risolta: tira o modifica i valori.');
      combat.combatants = initiativeOrder(combat).order;
      combat.round = Math.max(1, combat.round); combat.pass = 1; combat.turn = 0; combat.status = 'active';
      if (!eligibleCombatants(system, combat).length) throw new Error('Nessun combattente raggiunge la soglia minima di iniziativa.');
    } else if (command.type === 'next') advanceCombat(system, combat, characters, resources, random);
    else if (command.type === 'finish') combat.status = 'finished';
    if (command.type === 'value' || command.type === 'next' || command.type === 'start') {
      const message = definition.encounter_resolution_message;
      if (message && combat.round > 0) {
        const result = combatContext(system, combat, characters, resources).encounter.evaluate(message);
        if (result !== null && typeof result !== 'string') throw new Error('Messaggio fine incontro non valido.');
        if (result !== null) combat.status = 'finished';
        else if (command.type === 'value' && combat.status === 'finished') combat.status = 'active';
      }
    }
    combat.revision++; combat.updatedAt = new Date().toISOString();
    await database.combats.put(combat);
  });
}
