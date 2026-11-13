/** @file Collection contracts and pinned original diagnostic regressions. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { createEvaluator } from '../src/engine/formulas';
import { parseSystem } from '../src/importing/system';
import { demo } from '../src/demo';
import { base, constant, list, stat } from './fixtures/capabilities';

it('sorts homogeneous selectors stably without mutating the original array', () => {
  const values = [3, 1, 2, 1];
  const e = createEvaluator([base('values', 'array', values, 'integer')]);
  const sort = { type: 'sortBy', components: stat('values'), sort_by_selector: stat('$sortByValue'), order: 'asc' };
  expect(e.evaluate(sort)).toEqual([1, 1, 2, 3]);
  expect(e.evaluate({ ...sort, order: 'desc' })).toEqual([3, 2, 1, 1]);
  expect(values).toEqual([3, 1, 2, 1]);
  expect(e.evaluate({ ...sort, sort_by_selector: constant(0) })).toEqual(values);
  expect(e.evaluate({ ...sort, sort_by_value_key: '$item', sort_by_selector: stat('$item') })).toEqual([1, 1, 2, 3]);
  expect(() => e.get('$item')).toThrow();
  expect(e.evaluate({ ...sort, components: list() })).toEqual([]);
  expect(e.evaluate({ ...sort, components: list(constant('b'), constant('A'), constant('a')) })).toEqual(['A', 'a', 'b']);
  for (const bad of [
    { order: 'unknown' }, { order: null }, { sort_by_selector: constant(null) },
    { sort_by_selector: constant(true) }, { sort_by_value_key: '__proto__.x' },
    { components: list(constant(1), constant('a')) }
  ]) expect(() => e.evaluate({ ...sort, ...bad })).toThrow();
});

it('uses strict null and string operations without coercion', () => {
  const e = createEvaluator([]);
  expect(e.evaluate({ type: 'isNull', components: constant(null) })).toBe(true);
  for (const value of [0, '', false]) expect(e.evaluate({ type: 'isNull', components: constant(value) })).toBe(false);
  expect(e.evaluate({ type: 'toLowerCase', components: constant('FIGHTER À') })).toBe('fighter à');
  expect(() => e.evaluate({ type: 'toLowerCase', components: constant(12) })).toThrow();
  expect(e.evaluate({ type: 'contains', haystack: constant('fighter'), needle: constant('fight') })).toBe(true);
  expect(e.evaluate({ type: 'contains', haystack: constant('Fighter'), needle: constant('fight') })).toBe(false);
  expect(e.evaluate({ type: 'contains', haystack: list(constant(1)), needle: constant('1') })).toBe(false);
  expect(e.evaluate({ type: 'contains', haystack: list(), needle: constant(1) })).toBe(false);
  expect(() => e.evaluate({ type: 'contains', haystack: constant('12'), needle: constant(1) })).toThrow();
  expect(() => e.evaluate({ type: 'contains', haystack: constant(null), needle: constant(1) })).toThrow();
  expect(e.evaluate({ type: 'contains', haystack: list(constant({ resourceId: 'a' }, 'resource')), needle: constant({ resourceId: 'a' }, 'resource') })).toBe(true);
});

it('evaluates notNull without coercion and retains nested failures and lambda scopes', () => {
  const e = createEvaluator([]);
  expect(e.evaluate({ type: 'notNull', components: constant(null) })).toBe(false);
  for (const components of [constant(0), constant(false), constant(''), list()]) {
    expect(e.evaluate({ type: 'notNull', components })).toBe(true);
    expect(parseSystem(JSON.stringify({ ...demo, character_stats: [{
      id: 'present', name: 'Present', type: 'calculated', value_type: 'bool',
      components: { type: 'notNull', components }
    }] })).diagnostics.filter(d => d.path.startsWith('$.character_stats'))).toEqual([]);
  }
  expect(e.evaluate({ type: 'map', components: list(constant(null), constant(0)),
    mapper: { type: 'notNull', components: stat('$mapValue') } })).toEqual([false, true]);
  expect(() => e.get('$mapValue')).toThrow();
  expect(() => e.evaluate({ type: 'notNull' })).toThrow();
  expect(() => e.evaluate({ type: 'notNull', components: { type: 'unsupported' } })).toThrow('non supportata');
});

it('finds the first match lazily, returns null for no match and restores bindings on error', () => {
  const e = createEvaluator([]);
  const find = { type: 'findFirst', components: list(constant(1), constant(3), constant(4)),
    filter: { type: 'greaterThan', components: list(stat('$findFirstValue'), constant(2)) } };
  expect(e.evaluate(find)).toBe(3);
  expect(e.evaluate({ ...find, filter: null })).toBe(1);
  expect(e.evaluate({ ...find, components: list() })).toBeNull();
  expect(e.evaluate({ ...find, filter: constant(false) })).toBeNull();
  expect(e.evaluate({ ...find, find_first_value_key: '$item',
    filter: { type: 'equals', components: list(stat('$item'), constant(4)) } })).toBe(4);
  expect(() => e.evaluate({ ...find, filter: constant(1) })).toThrow();
  expect(() => e.get('$findFirstValue')).toThrow();
  expect(() => e.get('$item')).toThrow();
});

it('flatMaps one level with lexical outer scopes and strict bounded outputs', () => {
  const e = createEvaluator([]);
  const flat = { type: 'flatMap', components: list(constant(1), constant(2)), mapper: list(stat('$mapValue'), constant(9)) };
  expect(e.evaluate(flat)).toEqual([1, 9, 2, 9]);
  expect(e.evaluate({ ...flat, components: list() })).toEqual([]);
  expect(e.evaluate({ ...flat, mapper: list(list(stat('$mapValue'))) })).toEqual([[1], [2]]);
  expect(e.evaluate({ type: 'map', components: list(constant(10), constant(20)), map_value_key: '$outer',
    mapper: { ...flat, mapper: list({ type: 'add', components: list(stat('$outer'), stat('$mapValue')) }) } })).toEqual([[11, 12], [21, 22]]);
  expect(() => e.evaluate({ ...flat, mapper: constant(1) })).toThrow();
  expect(() => e.get('$mapValue')).toThrow();
  expect(() => createEvaluator([], {}, { steps: 4, depth: 64 }).evaluate(flat)).toThrow('Limite');
  const large = constant(Array.from({ length: 6000 }, () => 1), 'array');
  expect(() => e.evaluate({ ...flat, mapper: { ...large, sub_value_type: 'integer' } })).toThrow('troppo grande');
});

it('diagnoses missing operands, invalid order and nested unsupported expressions', () => {
  for (const components of [
    { type: 'sortBy', components: list(), sort_by_selector: stat('$sortByValue'), order: 'asc' },
    { type: 'findFirst', components: list() },
    { type: 'flatMap', components: list(), mapper: list(stat('$mapValue')) },
    { type: 'contains', haystack: list(), needle: constant(1) }
  ]) {
    const source = { ...demo, character_stats: [{ id: 'test', name: 'Test', type: 'calculated', value_type: 'array', components }] };
    expect(parseSystem(JSON.stringify(source)).diagnostics.filter(d => d.path.startsWith('$.character_stats'))).toEqual([]);
  }
  for (const components of [
    { type: 'sortBy', components: list(), sort_by_selector: constant(1) },
    { type: 'flatMap', components: list() }, { type: 'contains', haystack: list() },
    { type: 'isNull' }, { type: 'notNull' }, { type: 'toLowerCase' }, { type: 'findFirst', components: [] }
  ]) expect(parseSystem(JSON.stringify({ ...demo, character_stats: [{
    id: 'test', name: 'Test', type: 'calculated', value_type: 'bool', components
  }] })).diagnostics.some(d => d.severity === 'error')).toBe(true);
});

for (const path of ['.reference/archer-system.rpg', '.reference/derpsy-system.rpg']) {
  it.skipIf(!existsSync(path))(`evaluates unchanged collection formulas from ${path}`, () => {
    const { definition, diagnostics } = parseSystem(gunzipSync(readFileSync(path)).toString('utf8'));
    expect(diagnostics.filter(d => d.message.match(/Formula non supportata: (sortBy|isNull|contains|findFirst|flatMap|toLowerCase)$/))).toEqual([]);
    expect(diagnostics.filter(d => d.path.startsWith('$.character_stats') && d.severity === 'error')).toEqual([]);
    const stats = definition.character_stats;
    expect(createEvaluator(stats).get('equipped_armor')).toBeNull();
    const armors = ['first', 'second'].map(id => ({
      id, name: id, systemKey: 'test', definitionId: 'armor', values: {}
    }));
    const equipped = createEvaluator(stats, {
      armors: armors.map(r => ({ resourceId: r.id })), equipped_armor_id: 'second'
    }, undefined, { resources: armors, resourceDefinitions: definition.resources });
    expect(equipped.get('equipped_armor')).toEqual({ resourceId: 'second' });
    expect(equipped.get('equipped_armor.id')).toBe('second');
    expect(equipped.evaluate({ type: 'defined', stat: 'equipped_armor.id' })).toBe(true);
    // Manual defaults have no race: required paths must fail, not become empty lists.
    expect(() => createEvaluator(stats).get('racial_traits')).toThrow('race.traits');
    expect(() => createEvaluator(stats).get('all_weapons')).toThrow('race.weapons');
    const allWeapons = stats.find(s => s.id === 'all_weapons')!;
    const parts = allWeapons.components?.components;
    if (!Array.isArray(parts)) throw new Error('Original all_weapons must have an operand list');
    const flatMap = parts[1];
    expect(createEvaluator(stats).evaluate(flatMap)).toEqual([]);
    expect(() => createEvaluator(stats).get('has_jack_of_all_trades')).toThrow('race.current_level_traits');
  });
}
