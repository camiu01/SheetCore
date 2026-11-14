/**
 * @file Source-defined encounter evaluation and bounded initiative commands.
 * @remarks No general mechanic/event engine is implied. On-create supports the
 * verified synchronous sequence of one set override per target.
 * @see https://docs.rpg-companion.app/System/CombatSystem
 */
import { jsonValue, matchesType, object, type Character, type Combat, type ResourceInstance, type Stat, type StoredSystem } from '../domain/model';
import { createEvaluator, RuntimeResource, type EvaluationEnvironment } from './formulas';
import { rollDice } from './dice';
import { checkReferences } from '../domain/references';

/** Resolve an encounter snapshot without loading code or accessing a database. */
export function combatContext(system: StoredSystem, combat: Combat, characters: Character[], resources: ResourceInstance[], roll?: (expression: string) => number) {
  const definition = system.definition.combat_system;
  if (!definition || combat.systemKey !== system.key) throw new Error('Sistema di combattimento mancante o non corrispondente.');
  const definitions = system.definition.resources;
  const environment: EvaluationEnvironment = { resources, resourceDefinitions: definitions, createdAt: combat.createdAt, roll, enumerations: system.definition.enumerated_types };
  const globals: Record<string, unknown> = { $combat_difficulty: combat.difficulty };
  environment.variables = globals;
  const scopes = new Map<string, RuntimeResource>();
  function resource(id: string) {
    const record = resources.find(r => r.id === id && r.systemKey === system.key);
    const d = definitions.find(d => d.id === record?.definitionId);
    if (!record || !d) throw new Error(`Risorsa del combattente mancante: ${id}`);
    return new RuntimeResource(`resource:${id}`, d.stats, record.values, record.createdAt);
  }
  for (const fighter of combat.combatants) {
    const type = definition.combatant_types.find(t => t.id === fighter.typeId);
    if (!type) throw new Error('Tipo combattente mancante.');
    let stats: Stat[], values: Record<string, unknown>, createdAt = fighter.createdAt;
    if (fighter.characterId) {
      const character = characters.find(c => c.id === fighter.characterId && c.systemKey === system.key);
      if (!character || type.template_resource_id !== 'character' || type.instance_resource_id) throw new Error('Personaggio del combattente non valido.');
      stats = system.definition.character_stats; values = character.values; createdAt = character.createdAt;
    } else if (!type.instance_resource_id && fighter.resourceId) {
      const source = resource(fighter.resourceId);
      stats = source.stats; values = source.values; createdAt = source.createdAt ?? fighter.createdAt;
    } else {
      const d = definitions.find(d => d.id === type.instance_resource_id);
      if (!d) throw new Error('Definizione istanza combattente mancante.');
      stats = d.stats; values = fighter.values;
    }
    const variables: Record<string, unknown> = {
      $combatant_type: type.id, combatant_type: type.id,
      $template_resource_id: type.template_resource_id ?? null,
      $instance_resource_id: type.instance_resource_id ?? null
    };
    if (fighter.templateId) variables.$resource = resource(fighter.templateId);
    const scope = new RuntimeResource(`combatant:${fighter.id}`, stats, values, createdAt, variables, fighter.overrides);
    variables.$combatant = scope;
    scopes.set(fighter.id, scope);
  }
  const all = [...scopes.values()];
  const encounter = new RuntimeResource(`combat:${combat.id}`, definition.stats, {}, combat.createdAt, { combatants: all });
  globals.$combatants = all; globals.$combat = encounter;
  return {
    definition, environment, scopes,
    encounter: createEvaluator(definition.stats, {}, undefined, environment),
    actor(id: string) {
      const scope = scopes.get(id);
      if (!scope) throw new Error('Combattente non trovato.');
      return createEvaluator(scope.stats, scope.values, undefined, {
        ...environment, createdAt: scope.createdAt, overrides: scope.overrides,
        variables: { ...globals, ...scope.variables }
      });
    }
  };
}
/** Initialize a newly added instance exactly once; callers persist only on success. */
export function initializeCombatant(system: StoredSystem, combat: Combat, id: string, characters: Character[], resources: ResourceInstance[], random?: (faces: number) => number) {
  const fighter = combat.combatants.find(f => f.id === id);
  const type = system.definition.combat_system?.combatant_types.find(t => t.id === fighter?.typeId);
  if (!fighter || !type) throw new Error('Combattente non trovato.');
  if (!type.instance_resource_id || !type.on_create) return;
  const overrides = fighter.overrides;
  let steps = 0, rolls = 0;
  const touched = new Set<string>();
  function apply(value: unknown, depth: number) {
    if (++steps > 1000 || depth > 32) throw new Error('Inizializzazione troppo complessa.');
    const e = object(value);
    const allowed = e.type === 'sequence' ? ['type', 'effects', 'synchronous']
      : ['type', 'stat', 'meta_stat', 'new_value', 'aggregation_type', 'calculated_aggregation_type'];
    if (Object.keys(e).some(key => !allowed.includes(key))) throw new Error('Opzione on_create non supportata.');
    if (e.type === 'sequence') {
      if (e.synchronous !== true || !Array.isArray(e.effects)) throw new Error('Solo sequenze esplicitamente sincrone supportate in on_create.');
      e.effects.forEach(child => apply(child, depth + 1)); return;
    }
    if (e.type !== 'setStat' || e.aggregation_type !== 'set' || e.meta_stat != null || e.calculated_aggregation_type != null || typeof e.stat !== 'string' || touched.has(e.stat))
      throw new Error('on_create richiede un singolo override setStat/set per destinazione diretta.');
    const context = combatContext(system, combat, characters, resources, expression => {
      if (++rolls > 100) throw new Error('Troppi tiri durante inizializzazione.');
      return rollDice(expression, undefined, random).total;
    });
    const stat = context.scopes.get(id)?.stats.find(s => s.id === e.stat);
    const result = context.actor(id).evaluate(e.new_value);
    if (!stat || !matchesType(result, stat.value_type, stat.sub_value_type)) throw new Error(`Override iniziale non valido: ${e.stat}`);
    checkReferences([stat], { [stat.id]: result }, resources, system.key);
    overrides[e.stat] = jsonValue(result);
    touched.add(e.stat);
  }
  apply(type.on_create, 0);
}
/** Apply the documented descending initiative and numeric tie-breaker sequence. */
export function initiativeOrder<T extends { initiative: number | null; tieBreakers: (number | null)[] }>(combat: { combatants: T[] }) {
  let unresolved = false;
  const order = [...combat.combatants].sort((a, b) => {
    if (a.initiative === null || b.initiative === null) { unresolved = true; return 0; }
    if (a.initiative !== b.initiative) return b.initiative - a.initiative;
    for (let i = 0; i < Math.max(a.tieBreakers.length, b.tieBreakers.length); i++) {
      const av = a.tieBreakers[i], bv = b.tieBreakers[i];
      if (typeof av === 'number' && typeof bv === 'number' && av !== bv) return bv - av;
    }
    unresolved = true;
    return 0;
  });
  return { order, unresolved: unresolved || combat.combatants.some(f => f.initiative === null) };
}
/** Set all initiatives atomically in a command, never during rendering or reload. */
export function rollInitiatives(system: StoredSystem, combat: Combat, characters: Character[], resources: ResourceInstance[], random?: (faces: number) => number) {
  const context = combatContext(system, combat, characters, resources);
  if (!['perCombat', 'perRound'].includes(context.definition.initiative_system.when_to_set)) throw new Error('Modalità iniziativa non supportata.');
  const init = context.definition.initiative_system;
  for (const fighter of combat.combatants) {
    const evaluator = context.actor(fighter.id);
    const expression = init.roll_formula ? evaluator.evaluate(init.roll_formula) : null;
    if (expression !== null && typeof expression !== 'string') throw new Error('Formula iniziativa non testuale.');
    const modifier = evaluator.evaluate(init.initiative_modifier);
    if (!Number.isSafeInteger(modifier)) throw new Error('Modificatore iniziativa non intero.');
    fighter.initiative = (expression === null ? 0 : rollDice(expression, undefined, random).total) + Number(modifier);
    if (!Number.isSafeInteger(fighter.initiative) || Math.abs(fighter.initiative) > 1000000000) throw new Error('Iniziativa fuori limite.');
    fighter.tieBreakers = init.initiative_tie_breakers.map(f => {
      const value = evaluator.evaluate(f);
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Spareggio iniziativa non numerico.');
      return value as number | null;
    });
  }
  combat.combatants = initiativeOrder(combat).order;
}
/** Return actors eligible for this pass; never silently skip a dead actor. */
export function eligibleCombatants<T extends { initiative: number | null }>(system: StoredSystem, combat: { pass: number; combatants: T[] }) {
  const init = system.definition.combat_system?.initiative_system;
  const degrade = init?.initiative_degrade_per_pass;
  if (degrade == null) return combat.combatants;
  if (degrade <= 0 || init?.min_initiative_to_act == null) throw new Error('Passaggi iniziativa non validi.');
  return combat.combatants.filter(f => f.initiative !== null && f.initiative - (combat.pass - 1) * degrade >= init.min_initiative_to_act!);
}
/** Advance one turn/pass/round according to the source, retaining per-combat rolls. */
export function advanceCombat(system: StoredSystem, combat: Combat, characters: Character[], resources: ResourceInstance[], random?: (faces: number) => number) {
  const definition = system.definition.combat_system;
  if (!definition || combat.status !== 'active') throw new Error('Avvia prima l’incontro.');
  const eligible = eligibleCombatants(system, combat);
  if (definition.initiative_system.has_turns && combat.turn + 1 < eligible.length) { combat.turn++; return; }
  combat.turn = 0;
  if (definition.initiative_system.initiative_degrade_per_pass != null) {
    combat.pass++;
    if (combat.pass > 10000) throw new Error('Limite passaggi raggiunto.');
    if (eligibleCombatants(system, combat).length) return;
  }
  combat.round++; combat.pass = 1;
  if (combat.round > 100000) throw new Error('Limite round raggiunto.');
  if (definition.initiative_system.when_to_set === 'perRound') {
    rollInitiatives(system, combat, characters, resources, random);
    if (initiativeOrder(combat).unresolved || !eligibleCombatants(system, combat).length) combat.status = 'preparing';
  }
}
