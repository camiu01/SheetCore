/** @file Untrusted import validation and conservative unsupported-feature reporting. */
import { describe, expect, it } from 'vitest';
import { demo, demoOriginal } from '../src/demo';
import { boundedJson, decodeUtf8, parseSystem, prepareSystem } from '../src/importing/system';

describe('monolithic JSON import', () => {
  it('validates the original distributed fixture without compatibility warnings', () => {
    const parsed = parseSystem(demoOriginal);
    expect(parsed.definition.id).toBe('sheetcore-sentieri');
    expect(parsed.diagnostics).toEqual([]);
  });
  it('preserves unknown fields and identifies their exact path', () => {
    const parsed = parseSystem(JSON.stringify({ ...demo, future_extension: { secret_rule: 12 } }));
    expect(parsed.definition.future_extension).toEqual({ secret_rule: 12 });
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({ path: '$.future_extension' }));
  });
  it('reports missing root structure without crashing', () => {
    expect(() => parseSystem('{"id":"x"}')).toThrow('$.character_stats');
    expect(() => parseSystem('{bad')).toThrow('malformato');
  });
  it('rejects oversized, deep and prototype-bearing documents', () => {
    expect(() => boundedJson('"123456"', 4)).toThrow('grande');
    expect(() => boundedJson('{"__proto__":{"polluted":true}}')).toThrow('vietata');
    expect(() => boundedJson('['.repeat(66) + '0' + ']'.repeat(66))).toThrow('complesso');
  });
  it('diagnoses unknown view types and mechanics', () => {
    const parsed = parseSystem(JSON.stringify({ ...demo,
      mechanics: [{ id: 'unsafe', effects: { type: 'javascript' } }],
      character_sheet_sections: [{ id: 'new', view: { id: 'unknown', type: 'futureView' } }]
    }));
    expect(parsed.diagnostics.some(d => d.path.endsWith('.type') && d.message.includes('futureView'))).toBe(true);
    expect(parsed.diagnostics.some(d => d.path === '$.mechanics')).toBe(true);
  });
  it('flags duplicate IDs, wrong defaults, cycles and unresolved refs', () => {
    const data = structuredClone(demo);
    data.character_stats.push({ ...data.character_stats[0] });
    expect(parseSystem(JSON.stringify(data)).diagnostics.some(d => d.severity === 'error' && d.message.includes('duplicato'))).toBe(true);
    const circular = { ...demo, character_stats: [
      { id: 'a', name: 'A', type: 'calculated', value_type: 'integer', components: { type: 'stat', stat: 'b' } },
      { id: 'b', name: 'B', type: 'calculated', value_type: 'integer', components: { type: 'stat', stat: 'a' } }
    ] };
    expect(parseSystem(JSON.stringify(circular)).diagnostics.some(d => d.severity === 'error' && d.message.includes('circolare'))).toBe(true);
    expect(parseSystem(JSON.stringify({ ...demo, character_stats: [{ id: 'x', name: 'X', type: 'base', value_type: 'integer', default_value: 'wrong' }] })).diagnostics.some(d => d.path.endsWith('default_value'))).toBe(true);
  });
  it('does not silently interpret arrays as formula trees', () => {
    const data = { ...demo, character_stats: [{ id: 'x', name: 'X', type: 'calculated', value_type: 'integer', components: { type: 'add', components: [] } }] };
    expect(parseSystem(JSON.stringify(data)).diagnostics.some(d => d.severity === 'error' && d.path.endsWith('.components'))).toBe(true);
  });
  it('hashes exact source text and protects same-version alternate imports', async () => {
    const first = await prepareSystem(demoOriginal, 'fixture');
    const second = await prepareSystem(demoOriginal + '\n', 'fixture');
    expect(first.definition.version).toBe(second.definition.version);
    expect(first.key).not.toBe(second.key);
    expect(first.original).toBe(demoOriginal);
  });
  it('retains exact UTF-8 including a BOM and rejects malformed byte sequences', async () => {
    const original = '\ufeff' + demoOriginal;
    const decoded = decodeUtf8(new TextEncoder().encode(original));
    expect(decoded).toBe(original);
    expect((await prepareSystem(decoded, 'BOM fixture')).original).toBe(original);
    expect(decodeUtf8(new TextEncoder().encode('È una storia 🏹'))).toBe('È una storia 🏹');
    expect(() => decodeUtf8(Uint8Array.from([0xc3, 0x28]))).toThrow('UTF-8 valida');
  });
});
