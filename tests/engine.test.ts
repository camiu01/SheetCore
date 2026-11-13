/** @file Contract-derived expectations, independent of renderer implementation. */
import { describe, expect, it } from 'vitest';
import { createEvaluator } from '../src/engine/formulas';
import { rollDice } from '../src/engine/dice';
import type { Stat } from '../src/domain/model';

const constant = (value: unknown, value_type = typeof value === 'boolean' ? 'bool' : 'integer') => ({ type: 'constant', value, value_type });
const list = (...components: unknown[]) => ({ type: 'list', components });
const ref = (stat: string) => ({ type: 'stat', stat });
const calc = (id: string, components: ReturnType<typeof ref>): Stat => ({ id, name: id, type: 'calculated', value_type: 'integer', components });
describe('documented formula semantics', () => {
  it('evaluates the documented chained division example [20,2,5] = 2', () => {
    expect(createEvaluator([]).evaluate({ type: 'divide', rounding_method: 'none', components: list(constant(20), constant(2), constant(5)) })).toBe(2);
  });
  it.each([['down', -2], ['up', -1], ['none', -1.5]])('rounds negative division with %s', (rounding_method, expected) => {
    expect(createEvaluator([]).evaluate({ type: 'divide', rounding_method, components: list(constant(-3), constant(2)) })).toBe(expected);
  });
  it.each(['closest', undefined])('refuses unverified or unspecified rounding: %s', rounding_method => {
    expect(() => createEvaluator([]).evaluate({ type: 'divide', rounding_method, components: list(constant(1), constant(2)) })).toThrow('Arrotondamento');
  });
  it('adds, subtracts and multiplies ordered numeric operands', () => {
    const e = createEvaluator([]);
    expect(e.evaluate({ type: 'add', components: list(constant(2), constant(3)) })).toBe(5);
    expect(e.evaluate({ type: 'subtract', components: list(constant(20), constant(2), constant(5)) })).toBe(13);
    expect(e.evaluate({ type: 'multiply', components: list(constant(2), constant(3)) })).toBe(6);
  });
  it('recalculates dependencies from a new explicit snapshot', () => {
    const stats: Stat[] = [
      { id: 'a', name: 'A', type: 'base', value_type: 'integer', default_value: 2 },
      { id: 'b', name: 'B', type: 'calculated', value_type: 'integer', components: { type: 'add', components: list(ref('a'), constant(1)) } },
      calc('c', ref('b'))
    ];
    expect(createEvaluator(stats).get('c')).toBe(3);
    expect(createEvaluator(stats, { a: 9 }).get('c')).toBe(10);
    expect(createEvaluator(stats, { b: 999 }).get('c')).toBe(3);
  });
  it('detects cycles, missing references, invalid operands and division by zero', () => {
    expect(() => createEvaluator([calc('a', ref('b')), calc('b', ref('a'))]).get('a')).toThrow('circolare');
    expect(() => createEvaluator([]).get('missing')).toThrow('mancante');
    expect(() => createEvaluator([]).evaluate({ type: 'add', components: list(constant('2', 'string')) })).toThrow('numeri');
    expect(() => createEvaluator([]).evaluate({ type: 'divide', rounding_method: 'none', components: list(constant(1), constant(0)) })).toThrow('zero');
  });
  it('evaluates only the first true when clause', () => {
    expect(createEvaluator([]).evaluate({ type: 'when', clauses: [
      { condition: constant(false), components: ref('missing') },
      { condition: constant(true), components: constant(7) },
      { condition: constant(true), components: ref('also_missing') }
    ] })).toBe(7);
  });
  it('and does not short-circuit evaluation', () => {
    expect(() => createEvaluator([]).evaluate({ type: 'and', components: list(constant(false), ref('missing')) })).toThrow('mancante');
  });
  it('supports isEmpty only for text and arrays', () => {
    expect(createEvaluator([]).evaluate({ type: 'isEmpty', components: constant('', 'string') })).toBe(true);
    expect(createEvaluator([]).evaluate({ type: 'isEmpty', components: list(constant(1)) })).toBe(false);
    expect(() => createEvaluator([]).evaluate({ type: 'isEmpty', components: constant(null) })).toThrow();
  });
  it('bounds deep trees and total execution steps', () => {
    let tree: unknown = constant(1);
    for (let i = 0; i < 70; i++) tree = { type: 'add', components: list(tree) };
    expect(() => createEvaluator([]).evaluate(tree)).toThrow('Limite');
    expect(() => createEvaluator([], {}, { steps: 3, depth: 64 }).evaluate(list(constant(1), constant(2), constant(3)))).toThrow('Limite');
  });
  it('rejects JS execution requests instead of evaluating strings', () => {
    const text = 'globalThis.compromised = true';
    expect(createEvaluator([]).evaluate(constant(text, 'string'))).toBe(text);
    expect(() => createEvaluator([]).evaluate({ type: 'javascript', code: text })).toThrow('non supportata');
    expect(globalThis).not.toHaveProperty('compromised');
  });
});
describe('bounded dice', () => {
  it('calculates explicit faces and a modifier', () => {
    expect(rollDice('2d6 + 3', [6], () => 4)).toEqual({ results: [4, 4], total: 11 });
    expect(rollDice('1d6 - 2', [6], () => 1).total).toBe(-1);
  });
  it.each(['0d6', '101d6', '1d1', '1d1000001', '1d6;alert(1)', '2d6+1d4'])('rejects %s', expression => {
    expect(() => rollDice(expression)).toThrow();
  });
  it('checks imported faces and the full allowed count boundary', () => {
    expect(() => rollDice('1d20', [6])).toThrow('non definito');
    expect(rollDice('100d1000000', undefined, faces => faces).total).toBe(100000000);
    const actual = rollDice('100d6');
    expect(actual.results).toHaveLength(100);
    expect(actual.results.every(v => v >= 1 && v <= 6)).toBe(true);
  });
});
