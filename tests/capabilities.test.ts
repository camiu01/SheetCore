/** @file Independent expected formula values and real persistence/encounter regressions. */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createEvaluator, formatSourceDate, RuntimeResource } from '../src/engine/formulas';
import { combatContext, advanceCombat, initiativeOrder } from '../src/engine/combat';
import { isPhoto, photoFromBytes, photoImageUrl } from '../src/domain/photo';
import { isResourceReference, type Combat, type ResourceInstance } from '../src/domain/model';
import { SheetDatabase, createCharacter, installSystem, setCharacterValue } from '../src/persistence/db';
import { commandCombat, createCombat } from '../src/persistence/combat';
import { saveResource, deleteResource } from '../src/persistence/resources';
import { exportBackup, restoreBackup, validateBackup } from '../src/persistence/backup';
import { prepareSystem } from '../src/importing/system';
import { capabilitySystem, constant, stat, list, base } from './fixtures/capabilities';

const databases: SheetDatabase[] = [];
afterEach(async () => { for (const database of databases.splice(0)) await database.delete(); });
async function setup(source: unknown = capabilitySystem) {
  const database = new SheetDatabase(`capabilities-${crypto.randomUUID()}`); databases.push(database);
  const system = await prepareSystem(typeof source === 'string' ? source : JSON.stringify(source), 'Original MIT regression fixture');
  expect(system.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  await installSystem(system, database);
  return { database, system };
}
describe('documented formulas', () => {
  const evaluator = () => createEvaluator([]);
  it('evaluates the native dice expression helpers without coercing comparisons', () => {
    expect(evaluator().evaluate({ type: 'trim', components: constant(' 1d6 + 2 ') })).toBe('1d6 + 2');
    expect(evaluator().evaluate({ type: 'flatAppend', components: [list(constant(1), constant(2)), list(constant(1))] })).toEqual([1, 2, 1]);
    expect(evaluator().evaluate({ type: 'flatAppend', treat_as_set: true, components: [list(constant(1), constant(2)), list(constant(1))] })).toEqual([1, 2]);
    expect(evaluator().evaluate({ type: 'notEquals', components: list(constant(1), constant(2), constant(1)) })).toBe(true);
    expect(evaluator().evaluate({ type: 'notEquals', components: list(constant(1), constant('1')) })).toBe(true);
    expect(evaluator().evaluate({ type: 'or', components: list(constant(false), constant(true)) })).toBe(true);
    expect(() => evaluator().evaluate({ type: 'or', components: list(constant(1)) })).toThrow();
    expect(() => evaluator().evaluate({ type: 'flatAppend', treat_as_set: 'true', components: [] })).toThrow();
  });
  it('concatenates documented strings/numbers and rejects booleans/null', () => {
    expect(evaluator().evaluate({ type: 'concat', components: list(constant('STR: '), constant(18), constant(' (+'), constant(4), constant(')')) })).toBe('STR: 18 (+4)');
    expect(() => evaluator().evaluate({ type: 'concat', components: list(constant(true)) })).toThrow();
  });
  it('joins mixed documented values with an exact separator', () => {
    expect(evaluator().evaluate({ type: 'joinToString', separator: ' + ', components: list(constant(1), constant(2), constant('hello'), constant(3)) })).toBe('1 + 2 + hello + 3');
  });
  it('formats stored timestamps and rejects invalid calendar dates', () => {
    expect(formatSourceDate('2020-01-02T12:00:00Z')).toBe('Jan 02, 2020');
    expect(formatSourceDate('2020-01-02T00:30:00+02:00')).toBe('Jan 01, 2020');
    expect(() => formatSourceDate('2021-02-29T12:00:00Z')).toThrow();
    expect(() => formatSourceDate('not a date')).toThrow();
    expect(createEvaluator([], {}, undefined, { createdAt: '2020-01-02T12:00:00Z' }).evaluate({ type: 'date', components: stat('created_at') })).toBe('Jan 02, 2020');
  });
  it('uses null fallback lazily without treating zero or false as null', () => {
    const fallback = (v: unknown) => ({ type: 'defaultIfNull', components: constant(v, v === false ? 'bool' : 'integer'), default_components: { type: 'notImplemented' } });
    expect(evaluator().evaluate(fallback(0))).toBe(0); expect(evaluator().evaluate(fallback(false))).toBe(false);
    expect(evaluator().evaluate({ ...fallback(null), default_components: constant(7) })).toBe(7);
  });
  it('maps the public [1,2,3] example to [2,3,4]', () => {
    expect(evaluator().evaluate({ type: 'map', components: list(constant(1), constant(2), constant(3)), mapper: { type: 'add', components: list(stat('$mapValue'), constant(1)) } })).toEqual([2, 3, 4]);
  });
  it('retains outer lambda bindings without leaking inner bindings', () => {
    const e = evaluator();
    expect(e.evaluate({ type: 'map', map_value_key: '$outer', components: list(constant(10), constant(20)),
      mapper: { type: 'map', components: list(constant(1), constant(2)), mapper: { type: 'add', components: list(stat('$outer'), stat('$mapValue')) } } })).toEqual([[11, 12], [21, 22]]);
    expect(() => e.get('$outer')).toThrow();
  });
  it('filters strictly boolean conditions and preserves source order', () => {
    expect(evaluator().evaluate({ type: 'filter', components: list(constant(3), constant(1), constant(4)), filter: { type: 'greaterThan', components: list(stat('$filterValue'), constant(2)) } })).toEqual([3, 4]);
    expect(() => evaluator().evaluate({ type: 'filter', components: list(constant(1)), filter: constant(1) })).toThrow();
  });
  it('requires nonempty numeric max/min operands', () => {
    expect(evaluator().evaluate({ type: 'max', components: list(constant(-4), constant(12), constant(2)) })).toBe(12);
    expect(evaluator().evaluate({ type: 'min', components: list(constant(-4), constant(12)) })).toBe(-4);
    expect(() => evaluator().evaluate({ type: 'max', components: list() })).toThrow('non vuota');
  });
  it('resolves optional paths, declared null values and dynamic stat names safely', () => {
    const e = createEvaluator([base('a', 'resource', null), base('score', 'integer', 4)]);
    expect(e.get('a?.name')).toBeNull();
    expect(e.evaluate({ type: 'defined', stat: 'a' })).toBe(true);
    expect(e.evaluate({ type: 'defined', stat: 'missing' })).toBe(false);
    expect(e.evaluate({ type: 'metaStat', meta_stat: constant('score') })).toBe(4);
    expect(() => e.get('a.name')).toThrow();
    expect(() => e.get('a.__proto__')).toThrow();
  });
  it('resolves nested resources with a shared cycle/operation budget', () => {
    const resources: ResourceInstance[] = [{ id: 'r', systemKey: 's', definitionId: 'kind', name: 'Instance', values: { score: 9 } }];
    const e = createEvaluator([base('origin', 'resource', { resourceId: 'r' })], {}, undefined, { resources, resourceDefinitions: [{ id: 'kind', name: 'Kind', stats: [base('score', 'integer', 1)] }] });
    expect(e.get('origin.score')).toBe(9);
    expect(createEvaluator([], {}, undefined, { variables: { $actor: new RuntimeResource('a', [base('score', 'integer', 8)], {}) } }).get('$actor.score')).toBe(8);
    expect(() => createEvaluator([], {}, { steps: 5, depth: 3 }).evaluate({ type: 'map', components: list(constant(1), constant(2), constant(3)), mapper: stat('$mapValue') })).toThrow('Limite');
  });
  it('does not cache contextual calculated results across iterations', () => {
    const e = createEvaluator([{ id: 'bound', name: 'Bound', type: 'calculated', value_type: 'integer', components: stat('$mapValue') }]);
    expect(e.evaluate({ type: 'map', components: list(constant(2), constant(8)), mapper: stat('bound') })).toEqual([2, 8]);
  });
  it('bypasses caches explicitly and never rolls during read-only rendering', () => {
    let count = 0;
    const e = createEvaluator([{ id: 'random', name: 'Random', type: 'calculated', value_type: 'integer', components: { type: 'roll', formula: constant('1d6') } }], {}, undefined, { roll: () => ++count });
    expect(e.get('random')).toBe(1); expect(e.get('random')).toBe(1);
    expect(e.evaluate({ type: 'stat', stat: 'random', ignore_cache: true, for_resource: null })).toBe(2);
    expect(() => evaluator().evaluate({ type: 'roll', formula: constant('1d6') })).toThrow('comando');
  });
});
describe('typed persistence and combat', () => {
  const setHp = { type: 'setStat', stat: 'hp', aggregation_type: 'set', new_value: constant(3) };
  it.each([
    ['concurrent sequence', { type: 'sequence', synchronous: false, effects: [setHp] }],
    ['implicit sequence', { type: 'sequence', effects: [setHp] }],
    ['unknown condition', { ...setHp, condition: constant(false) }],
    ['dynamic destination', { ...setHp, meta_stat: constant('hp') }],
    ['calculated aggregation', { ...setHp, calculated_aggregation_type: 'add' }],
    ['repeated destination', { type: 'sequence', synchronous: true, effects: [setHp, setHp] }]
  ])('rejects unsupported initializer: %s without partial persistence', async (_label, onCreate) => {
    const source = capabilitySystem;
    const { database, system } = await setup({ ...source, combat_system: { ...source.combat_system,
      combatant_types: [{ ...source.combat_system.combatant_types[0], on_create: onCreate }]
    } });
    const combat = await createCombat(system.key, 'Unsupported initializer', database);
    await expect(commandCombat(combat.id, { type: 'add', typeId: 'scout' }, database)).rejects.toThrow();
    expect((await database.combats.get(combat.id))?.combatants).toEqual([]);
  });
  it('preserves resource references, blocks dangling/cross-version links and restores v3', async () => {
    const { database, system } = await setup();
    const c = await createCharacter(system, 'Ada', database);
    const r: ResourceInstance = { id: 'r', systemKey: system.key, definitionId: 'scout', name: 'Sentinella', values: { name: 'Sentinella', hp: 6, initiative: 2 } };
    await saveResource(r, database); await setCharacterValue(c.id, 'origin', { resourceId: 'r' }, database);
    await setCharacterValue(c.id, 'companions', [{ resourceId: 'r' }], database);
    await expect(setCharacterValue(c.id, 'origin', { resourceId: 'missing' }, database)).rejects.toThrow();
    const other = await prepareSystem(JSON.stringify({ ...capabilitySystem, version: '2' }), 'different version');
    await installSystem(other, database); await saveResource({ ...r, id: 'foreign', systemKey: other.key }, database);
    await expect(setCharacterValue(c.id, 'origin', { resourceId: 'foreign' }, database)).rejects.toThrow();
    await expect(deleteResource('r', database)).rejects.toThrow('riferimento');
    const backup = await exportBackup(database);
    expect(JSON.parse(backup).version).toBe(3);
    await restoreBackup(backup, database);
    expect(isResourceReference((await database.characters.get(c.id))?.values.origin)).toBe(true);
    const bad = JSON.parse(backup); bad.characters[0].values.origin.resourceId = 'missing';
    await expect(restoreBackup(JSON.stringify(bad), database)).rejects.toThrow();
    expect(await database.characters.count()).toBe(1);
    for (const version of [1, 2]) { const old = JSON.parse(backup); old.version = version; delete old.combats; expect((await validateBackup(JSON.stringify(old))).version).toBe(version); }
  });
  it('initializes once, persists overrides, reopens, advances, archives and restores atomically', async () => {
    const { database, system } = await setup();
    const combat = await createCombat(system.key, 'Passo', database);
    await commandCombat(combat.id, { type: 'add', typeId: 'scout' }, database, () => 4);
    await commandCombat(combat.id, { type: 'add', typeId: 'scout' }, database, () => 5);
    let stored = (await database.combats.get(combat.id))!;
    expect(stored.combatants.map(f => f.overrides.hp)).toEqual([4, 5]);
    expect(stored.combatants[0].values.hp).toBe(6);
    await commandCombat(combat.id, { type: 'initiative', id: stored.combatants[0].id, value: 15 }, database);
    await commandCombat(combat.id, { type: 'initiative', id: stored.combatants[1].id, value: 10 }, database);
    await commandCombat(combat.id, { type: 'start' }, database);
    await commandCombat(combat.id, { type: 'next' }, database);
    expect((await database.combats.get(combat.id))?.turn).toBe(1);
    await commandCombat(combat.id, { type: 'next' }, database);
    stored = (await database.combats.get(combat.id))!;
    expect(stored.round).toBe(2); expect(stored.combatants[0].initiative).toBe(15);
    await Promise.all(stored.combatants.map((f, i) => commandCombat(combat.id, { type: 'value', id: f.id, statId: 'hp', value: i + 1 }, database)));
    const backup = await exportBackup(database);
    database.close(); await database.open();
    await restoreBackup(backup, database);
    stored = (await database.combats.get(combat.id))!;
    expect(stored.combatants.map(f => f.overrides.hp)).toEqual([1, 2]);
    expect(combatContext(system, stored, [], []).encounter.get('roster_size')).toBe(2);
    const bad = JSON.parse(backup); bad.combats[0].combatants[0].overrides.hp = 'bad';
    await expect(restoreBackup(JSON.stringify(bad), database)).rejects.toThrow();
    expect((await database.combats.get(combat.id))?.round).toBe(2);
    for (const mutate of [
      (b: typeof bad) => { b.combats[0].combatants[0].initiative = null; },
      (b: typeof bad) => { b.combats[0].combatants[0].overrides.initiative = 40; },
      (b: typeof bad) => { b.combats[0].combatants[0].resourceId = 'unexpected'; }
    ]) {
      const invalid = JSON.parse(backup); mutate(invalid);
      await expect(restoreBackup(JSON.stringify(invalid), database)).rejects.toThrow();
      expect((await database.combats.get(combat.id))?.round).toBe(2);
    }
  });
  it('does not create partial instances if initialization fails', async () => {
    const source = structuredClone(capabilitySystem);
    source.combat_system.combatant_types[0].on_create!.effects[0].stat = 'missing';
    const { database, system } = await setup(source);
    const combat = await createCombat(system.key, 'Failure', database);
    await expect(commandCombat(combat.id, { type: 'add', typeId: 'scout' }, database)).rejects.toThrow();
    expect((await database.combats.get(combat.id))?.combatants).toEqual([]);
  });
  it('keeps PC edits linked to the latest character and preserves its pin', async () => {
    const { database, system } = await setup();
    const c = await createCharacter(system, 'Ada', database);
    const combat = await createCombat(system.key, 'Link', database);
    await commandCombat(combat.id, { type: 'add', typeId: 'hero', sourceId: c.id }, database);
    const f = (await database.combats.get(combat.id))!.combatants[0];
    await setCharacterValue(c.id, 'ingegno', 9, database);
    await commandCombat(combat.id, { type: 'value', id: f.id, statId: 'vigore', value: 7 }, database);
    expect((await database.characters.get(c.id))?.values).toMatchObject({ ingegno: 9, vigore: 7 });
    expect((await database.characters.get(c.id))?.systemKey).toBe(system.key);
    await expect(commandCombat(combat.id, { type: 'add', typeId: 'hero', sourceId: c.id }, database)).rejects.toThrow('già');
  });
  it('requires manual resolution of unresolved ties and rerolls per-round initiative', async () => {
    const source = structuredClone(capabilitySystem); source.combat_system.initiative_system.when_to_set = 'perRound';
    const { database, system } = await setup(source); const c = await createCombat(system.key, 'Rounds', database);
    await commandCombat(c.id, { type: 'add', typeId: 'scout' }, database, () => 1);
    await commandCombat(c.id, { type: 'add', typeId: 'scout' }, database, () => 2);
    await commandCombat(c.id, { type: 'roll' }, database, () => 3);
    await expect(commandCombat(c.id, { type: 'start' }, database)).rejects.toThrow('parità');
    const stored = (await database.combats.get(c.id))!;
    await commandCombat(c.id, { type: 'initiative', id: stored.combatants[0].id, value: 8 }, database);
    await commandCombat(c.id, { type: 'start' }, database);
    await commandCombat(c.id, { type: 'next' }, database);
    await commandCombat(c.id, { type: 'next' }, database, () => 4);
    expect((await database.combats.get(c.id))?.status).toBe('preparing');
    expect((await database.combats.get(c.id))?.round).toBe(2);
  });
  it('handles initiative degradation passes without rerolling per-combat values', async () => {
    const { system } = await setup();
    system.definition.combat_system!.initiative_system.initiative_degrade_per_pass = 5;
    system.definition.combat_system!.initiative_system.min_initiative_to_act = 1;
    const f = (id: string, initiative: number) => ({ id, typeId: 'scout', initiative, tieBreakers: [], values: {}, overrides: {}, createdAt: new Date().toISOString() });
    const combat: Combat = { id: 'c', name: 'C', systemKey: system.key, difficulty: 'calm', status: 'active', round: 1, pass: 1, turn: 1, revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), combatants: [f('a', 9), f('b', 4)] };
    advanceCombat(system, combat, [], []); expect(combat.pass).toBe(2); expect(combat.turn).toBe(0);
    advanceCombat(system, combat, [], []); expect(combat.round).toBe(2); expect(combat.pass).toBe(1);
    expect(initiativeOrder(combat).unresolved).toBe(false);
  });
  it('rejects starts below the source threshold and out-of-range initiative atomically', async () => {
    const source = structuredClone(capabilitySystem);
    const { database, system } = await setup({ ...source, combat_system: { ...source.combat_system, initiative_system: {
      ...source.combat_system.initiative_system, initiative_degrade_per_pass: 5, min_initiative_to_act: 1
    } } });
    const combat = await createCombat(system.key, 'Threshold', database);
    await commandCombat(combat.id, { type: 'add', typeId: 'scout' }, database, () => 1);
    const fighter = (await database.combats.get(combat.id))!.combatants[0];
    await commandCombat(combat.id, { type: 'initiative', id: fighter.id, value: 0 }, database);
    await expect(commandCombat(combat.id, { type: 'start' }, database)).rejects.toThrow('soglia');
    await expect(commandCombat(combat.id, { type: 'initiative', id: fighter.id, value: 1000000001 }, database)).rejects.toThrow();
    expect((await database.combats.get(combat.id))?.status).toBe('preparing');
  });
});
for (const [label, path] of [['Archer', '.reference/archer-system.rpg'], ['derpsy', '.reference/derpsy-system.rpg']]) {
  it.skipIf(!existsSync(path))(`reproduces reported ${label} diagnostics and runs its original monster initialization and XP rules`, async () => {
    const original = gunzipSync(readFileSync(path)).toString('utf8');
    const { database, system } = await setup(original);
    const reported = system.diagnostics.filter(d => /^\$\.character_stats\[(?:[0-9]|[12][0-9]|3[012])\](?:\.translatable|\.value_type|\.components)/.test(d.path));
    expect(reported).toEqual([]);
    expect(system.original).toBe(original);
    expect(createEvaluator(system.definition.character_stats, {}, undefined, { createdAt: '2020-01-02T12:00:00Z' }).get('created_at_display')).toBe('Created Jan 02, 2020');
    const monsterDef = system.definition.resources.find(r => r.id === 'monster')!;
    const rollDef = system.definition.resources.find(r => r.stats.some(s => s.id === 'formula') && r.id !== 'monster')!;
    const defaults = (stats: typeof monsterDef.stats) => Object.fromEntries(stats.filter(s => s.type === 'base').map(s => [s.id, s.default_value ?? null]));
    const roll: ResourceInstance = { id: 'dice', name: 'Original test dice', systemKey: system.key, definitionId: rollDef.id, values: { ...defaults(rollDef.stats), dice_amount: 1, dice_type: 'd6', constant: 0 } } as ResourceInstance;
    const monster: ResourceInstance = { id: 'monster', name: 'Original test scout', systemKey: system.key, definitionId: monsterDef.id, values: { ...defaults(monsterDef.stats), name: 'Original scout', hit_points: { resourceId: roll.id }, xp: 50, initiative: 2 } } as ResourceInstance;
    await saveResource(roll, database); await saveResource(monster, database);
    const combat = await createCombat(system.key, 'Real source', database);
    await commandCombat(combat.id, { type: 'add', typeId: 'monster_instance', sourceId: monster.id }, database, () => 4);
    await commandCombat(combat.id, { type: 'add', typeId: 'player' }, database);
    let stored = (await database.combats.get(combat.id))!;
    const enemy = stored.combatants[0], player = stored.combatants[1];
    expect(enemy.overrides.current_hp).toBe(4); expect(enemy.overrides.max_hp).toBe(4);
    expect(combatContext(system, stored, [], [roll, monster]).encounter.get('xp_pool')).toBe(50);
    expect(combatContext(system, stored, [], [roll, monster]).encounter.get('xp_to_deal')).toBe(50);
    await commandCombat(combat.id, { type: 'initiative', id: enemy.id, value: 15 }, database);
    await commandCombat(combat.id, { type: 'initiative', id: player.id, value: 10 }, database);
    await commandCombat(combat.id, { type: 'start' }, database);
    await commandCombat(combat.id, { type: 'value', id: enemy.id, statId: 'current_hp', value: 0 }, database);
    stored = (await database.combats.get(combat.id))!; expect(stored.status).toBe('finished');
    await commandCombat(combat.id, { type: 'value', id: enemy.id, statId: 'current_hp', value: 2 }, database);
    expect((await database.combats.get(combat.id))?.status).toBe('active');
    await restoreBackup(await exportBackup(database), database);
    expect((await database.combats.get(combat.id))?.combatants[0].overrides.current_hp).toBe(2);
  });
}
it('validates local photo shape, canonical bytes and dimensions without remote requests', () => {
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const photo = photoFromBytes(bytes);
  expect(isPhoto(photo)).toBe(true); expect(photoImageUrl(photo)).toMatch(/^data:image\/png;base64,/);
  expect(isPhoto({ url: null, base64: 'garbage' })).toBe(false);
  expect(() => photoFromBytes(new Uint8Array(1024 * 1024 + 1))).toThrow();
  const large = bytes.slice(); new DataView(large.buffer).setUint32(16, 4097);
  expect(() => photoFromBytes(large)).toThrow('4096');
});
