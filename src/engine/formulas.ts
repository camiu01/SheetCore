/**
 * @file Bounded, React-independent interpreter for the declared formula subset.
 * @see https://docs.rpg-companion.app/Stat/Formulas/StatFormulaComponent
 */
import { formula, isResourceReference, matchesType, object, type Node, type ResourceDefinition, type ResourceInstance, type Stat } from '../domain/model';
import { enumerationEntries, type EnumerationEntry } from './enumerations';

/** A trusted runtime scope, never serialized as a persisted stat value. */
export class RuntimeResource {
  constructor(
    readonly key: string, readonly stats: Stat[], readonly values: Record<string, unknown>,
    readonly createdAt?: string, readonly variables: Record<string, unknown> = {},
    readonly overrides: Record<string, unknown> = {},
    readonly instanceId?: string
  ) {}
}
export interface EvaluationEnvironment {
  createdAt?: string;
  resources?: ResourceInstance[];
  resourceDefinitions?: ResourceDefinition[];
  variables?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  /** Raw system `enumerated_types`, resolved lazily for enumerated formulas. */
  enumerations?: unknown[];
  /** Explicit opt-in for commands such as combat initialization, never rendering. */
  roll?: (expression: string) => number;
}
type ScopeApi = {
  scoped: (key: string, value: unknown, component: unknown) => unknown;
  defined: (path: string) => boolean;
  roll: (expression: string) => number;
  enumeration: (typeId: string, id: string, field: 'name' | 'abbreviation') => string;
};
type Handler = (node: Node, evaluate: (value: unknown) => unknown, stat: (id: string, bypass?: boolean) => unknown, scope: ScopeApi) => unknown;
/** Reject unsafe paths without evaluating code or walking object prototypes. */
export function statPath(path: string) {
  const parts = path.split('.');
  if (!path || parts.length > 64 || parts.some(p => !/^\$?[\w-]+\??$/.test(p)
    || ['__proto__', 'prototype', 'constructor'].includes(p.replace(/\?$/, '')))) {
    throw new Error(`Percorso statistica non valido: ${path}`);
  }
  return parts.map(part => ({ id: part.replace(/\?$/, ''), optional: part.endsWith('?') }));
}
class MissingStat extends Error {}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('La formula richiede una lista (massimo 10.000 elementi)');
  return value;
}
function stringParts(value: unknown): (string | number)[] {
  const parts = array(value);
  if (!parts.every((v): v is string | number => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))))
    throw new Error('Sono ammessi solo testi e numeri finiti');
  return parts;
}
function join(value: unknown, separator: string) {
  const parts = stringParts(value);
  if (parts.reduce<number>((n, v) => n + String(v).length, Math.max(0, parts.length - 1) * separator.length) > 1024 * 1024)
    throw new Error('Testo calcolato troppo grande');
  return parts.join(separator);
}
/** Format the documented ISO timestamp as English `MMM dd, yyyy`, in UTC. */
export function formatSourceDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error('date richiede un timestamp ISO 8601 con fuso orario');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || Number(value.slice(11, 13)) > 23
    || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59 || !Number.isFinite(Date.parse(value)))
    throw new Error('Timestamp ISO 8601 non valido');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
function numbers(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'number' && Number.isFinite(v)))
    throw new Error('La formula richiede una lista di numeri finiti');
  return value;
}
/** Allowed source fields per supported handler; extras produce import warnings. */
export const formulaFields: Record<string, string[]> = {
  constant: ['value', 'value_type', 'sub_value_type'],
  list: ['components'], stat: ['stat', 'for_resource', 'ignore_cache'],
  add: ['components'], subtract: ['components'], multiply: ['components'],
  divide: ['components', 'rounding_method'], when: ['clauses'],
  isEmpty: ['components'], and: ['components'], concat: ['components'],
  date: ['components'], defaultIfNull: ['components', 'default_components'],
  max: ['components'], min: ['components'], joinToString: ['components', 'separator'],
  map: ['components', 'mapper', 'map_value_key'], filter: ['components', 'filter', 'filter_value_key'],
  metaStat: ['meta_stat'], defined: ['stat'], equals: ['components'],
  greaterThan: ['components'], greaterThanEquals: ['components'],
  lessThan: ['components'], lessThanEquals: ['components'],
  length: ['components'], not: ['components'], roll: ['formula'],
  trim: ['components'], flatAppend: ['components', 'treat_as_set'], notEquals: ['components'], or: ['components'],
  isNull: ['components'], notNull: ['components'], toLowerCase: ['components'],
  contains: ['haystack', 'needle'], flatMap: ['components', 'mapper', 'map_value_key'],
  findFirst: ['components', 'filter', 'find_first_value_key'],
  sortBy: ['components', 'sort_by_selector', 'sort_by_value_key', 'order'],
  enumeratedName: ['enumerated_type', 'id'], enumeratedAbbreviation: ['enumerated_type', 'id'],
  toNum: ['components'], toSignedString: ['components'],
  replace: ['string', 'occurrence', 'replace']
};
/** Resolve one enumerated entry label through the scoped resolver. */
function enumeratedValue(scope: ScopeApi, node: Node, evaluate: (value: unknown) => unknown, field: 'name' | 'abbreviation') {
  if (typeof node.enumerated_type !== 'string' || !node.enumerated_type) throw new Error('enumerated_type richiesto');
  const id = evaluate(node.id);
  if (typeof id !== 'string' || !id) throw new Error('id di enumerazione non testuale');
  return scope.enumeration(node.enumerated_type, id, field);
}
/** Extensible handler registry. No dynamic JavaScript evaluation is used. */
export const formulaHandlers = new Map<string, Handler>([
  ['isNull', (n, e) => e(n.components) === null],
  ['notNull', (n, e) => e(n.components) !== null],
  ['toLowerCase', (n, e) => {
    const value = e(n.components);
    if (typeof value !== 'string') throw new Error('toLowerCase richiede testo');
    return value.toLowerCase();
  }],
  ['enumeratedName', (n, e, _get, scope) => enumeratedValue(scope, n, e, 'name')],
  ['enumeratedAbbreviation', (n, e, _get, scope) => enumeratedValue(scope, n, e, 'abbreviation')],
  ['toNum', (n, e) => {
    const value = e(n.components);
    if (typeof value !== 'string' || value.length > 64 || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))
      throw new Error('toNum richiede un numero testuale valido');
    return Number(value);
  }],
  ['toSignedString', (n, e) => {
    const value = e(n.components);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('toSignedString richiede un numero finito');
    return value >= 0 ? `+${value}` : String(value);
  }],
  ['replace', (n, e) => {
    const text = e(n.string), occurrence = e(n.occurrence), replacement = e(n.replace);
    if (typeof text !== 'string' || typeof occurrence !== 'string' || typeof replacement !== 'string')
      throw new Error('replace richiede tre testi');
    if (!occurrence) throw new Error('replace richiede una sottostringa non vuota');
    const result = text.split(occurrence).join(replacement);
    if (result.length > 1024 * 1024) throw new Error('Testo calcolato troppo grande');
    return result;
  }],
  ['contains', (n, e) => {
    const values = e(n.haystack), needle = e(n.needle);
    if (typeof values === 'string') {
      if (typeof needle !== 'string') throw new Error('contains richiede un testo da cercare');
      return values.includes(needle);
    }
    return array(values).some(v => v === needle || (isResourceReference(v) && isResourceReference(needle) && v.resourceId === needle.resourceId));
  }],
  ['flatMap', (n, e, _get, scope) => {
    const key = n.map_value_key ?? '$mapValue';
    if (typeof key !== 'string' || !/^\$?[\w-]+$/.test(key)) throw new Error('Chiave flatMap non valida');
    const result: unknown[] = [];
    for (const value of array(e(n.components))) {
      const mapped = array(scope.scoped(key, value, n.mapper));
      if (result.length + mapped.length > 10000) throw new Error('Lista calcolata troppo grande');
      result.push(...mapped);
    }
    return result;
  }],
  ['findFirst', (n, e, _get, scope) => {
    const key = n.find_first_value_key ?? '$findFirstValue';
    if (typeof key !== 'string' || !/^\$?[\w-]+$/.test(key)) throw new Error('Chiave findFirst non valida');
    for (const value of array(e(n.components))) {
      const match = n.filter == null ? true : scope.scoped(key, value, n.filter);
      if (typeof match !== 'boolean') throw new Error('findFirst richiede una condizione booleana');
      if (match) return value;
    }
    return null;
  }],
  ['sortBy', (n, e, _get, scope) => {
    if (n.order !== 'asc' && n.order !== 'desc') throw new Error('Ordine sortBy non valido');
    const key = n.sort_by_value_key ?? '$sortByValue';
    if (typeof key !== 'string' || !/^\$?[\w-]+$/.test(key)) throw new Error('Chiave sortBy non valida');
    const values = array(e(n.components)).map(value => ({ value, selected: scope.scoped(key, value, n.sort_by_selector) }));
    const type = typeof values[0]?.selected;
    if (!values.every(v => typeof v.selected === type && (typeof v.selected === 'string' || (typeof v.selected === 'number' && Number.isFinite(v.selected)))))
      throw new Error('sortBy richiede chiavi omogenee, testi o numeri finiti');
    return values.sort((a, b) => {
      const av = a.selected as string | number, bv = b.selected as string | number;
      return (av < bv ? -1 : av > bv ? 1 : 0) * (n.order === 'desc' ? -1 : 1);
    }).map(v => v.value);
  }],
  ['constant', n => {
    if (typeof n.value_type !== 'string' || !matchesType(n.value, n.value_type, typeof n.sub_value_type === 'string' ? n.sub_value_type : undefined))
      throw new Error('Costante con tipo o valore non valido');
    return n.value;
  }],
  ['stat', (n, _e, get) => {
    if (typeof n.stat !== 'string') throw new Error('Riferimento stat non valido');
    if (n.ignore_cache != null && typeof n.ignore_cache !== 'boolean') throw new Error('ignore_cache deve essere booleano');
    // for_resource is explicitly deprecated and ignored by the public contract.
    return get(n.stat, n.ignore_cache === true);
  }],
  ['list', (n, e) => {
    if (!Array.isArray(n.components)) throw new Error('list.components deve essere una lista');
    return n.components.map(e);
  }],
  ['add', (n, e) => numbers(e(n.components)).reduce((a, b) => a + b, 0)],
  ['subtract', (n, e) => {
    const values = numbers(e(n.components));
    if (!values.length) throw new Error('subtract richiede almeno un operando');
    return values.slice(1).reduce((a, b) => a - b, values[0]);
  }],
  ['multiply', (n, e) => numbers(e(n.components)).reduce((a, b) => a * b, 1)],
  ['divide', (n, e) => {
    const values = numbers(e(n.components));
    if (values.length < 2) throw new Error('divide richiede almeno due operandi');
    if (values.slice(1).includes(0)) throw new Error('Divisione per zero');
    const result = values.slice(1).reduce((a, b) => a / b, values[0]);
    if (n.rounding_method === 'down') return Math.floor(result);
    if (n.rounding_method === 'up') return Math.ceil(result);
    if (n.rounding_method === 'none') return result;
    throw new Error('Arrotondamento non supportato: specificare down, up o none');
  }],
  ['isEmpty', (n, e) => {
    const v = e(n.components);
    if (typeof v !== 'string' && !Array.isArray(v)) throw new Error('isEmpty richiede testo o lista');
    return v.length === 0;
  }],
  ['and', (n, e) => {
    const v = e(n.components);
    if (!Array.isArray(v) || !v.every(x => typeof x === 'boolean')) throw new Error('and richiede una lista di booleani');
    return v.every(Boolean);
  }],
  ['trim', (n, e) => {
    const value = e(n.components);
    if (typeof value !== 'string') throw new Error('trim richiede un testo');
    return value.trim();
  }],
  ['flatAppend', (n, e) => {
    if (n.treat_as_set != null && typeof n.treat_as_set !== 'boolean') throw new Error('treat_as_set richiede un booleano');
    const output: unknown[] = [], seen = new Set<unknown>(), resourceKeys = new Set<string>();
    for (const component of array(n.components)) for (const value of array(e(component))) {
      const key = isResourceReference(value) ? value.resourceId : value instanceof RuntimeResource ? value.key : undefined;
      if (n.treat_as_set === true && (key ? resourceKeys.has(key) : seen.has(value))) continue;
      if (output.length >= 10000) throw new Error('Lista calcolata troppo grande');
      if (key) resourceKeys.add(key); else seen.add(value);
      output.push(value);
    }
    return output;
  }],
  ['or', (n, e) => {
    const values = array(e(n.components));
    if (!values.every(v => typeof v === 'boolean')) throw new Error('or richiede booleani');
    return values.some(Boolean);
  }],
  ['notEquals', (n, e) => {
    const values = array(e(n.components));
    if (!values.every(v => v === null || ['string', 'number', 'boolean'].includes(typeof v))) throw new Error('notEquals richiede valori scalari');
    return values.slice(1).every((v, i) => v !== values[i]);
  }],
  ['concat', (n, e) => join(e(n.components), '')],
  ['date', (n, e) => formatSourceDate(e(n.components))],
  ['defaultIfNull', (n, e) => {
    const value = e(n.components);
    return value === null ? e(n.default_components) : value;
  }],
  ['max', (n, e) => {
    const values = numbers(e(n.components));
    if (!values.length) throw new Error('max richiede una lista non vuota');
    return values.reduce((a, b) => Math.max(a, b));
  }],
  ['min', (n, e) => {
    const values = numbers(e(n.components));
    if (!values.length) throw new Error('min richiede una lista non vuota');
    return values.reduce((a, b) => Math.min(a, b));
  }],
  ['joinToString', (n, e) => {
    if (typeof n.separator !== 'string') throw new Error('Separatore richiesto');
    return join(e(n.components), n.separator);
  }],
  ['map', (n, e, _get, scope) => {
    const key = n.map_value_key ?? '$mapValue';
    if (typeof key !== 'string' || !/^\$?[\w-]+$/.test(key)) throw new Error('Chiave map non valida');
    return array(e(n.components)).map(value => scope.scoped(key, value, n.mapper));
  }],
  ['filter', (n, e, _get, scope) => {
    const key = n.filter_value_key ?? '$filterValue';
    if (typeof key !== 'string' || !/^\$?[\w-]+$/.test(key)) throw new Error('Chiave filter non valida');
    return array(e(n.components)).filter(value => {
      const result = scope.scoped(key, value, n.filter);
      if (typeof result !== 'boolean') throw new Error('filter richiede una condizione booleana');
      return result;
    });
  }],
  ['metaStat', (n, e, get) => {
    const path = e(n.meta_stat);
    if (typeof path !== 'string') throw new Error('metaStat richiede un percorso testuale');
    return get(path);
  }],
  ['defined', (n, _e, _get, scope) => {
    if (typeof n.stat !== 'string') throw new Error('defined richiede un percorso');
    return scope.defined(n.stat);
  }],
  ['equals', (n, e) => {
    const values = array(e(n.components));
    if (!values.every(v => v === null || ['string', 'number', 'boolean'].includes(typeof v))) throw new Error('equals richiede valori scalari');
    return values.every(v => v === values[0]);
  }],
  ['length', (n, e) => {
    const value = e(n.components);
    if (typeof value !== 'string' && !Array.isArray(value)) throw new Error('length richiede testo o lista');
    return value.length;
  }],
  ['not', (n, e) => {
    const value = e(n.components);
    if (typeof value !== 'boolean') throw new Error('not richiede un booleano');
    return !value;
  }],
  ['roll', (n, e, _get, scope) => {
    const expression = e(n.formula);
    if (typeof expression !== 'string') throw new Error('Formula dadi testuale richiesta');
    return scope.roll(expression);
  }],
  ['when', (n, e) => {
    if (!Array.isArray(n.clauses)) throw new Error('when.clauses deve essere una lista');
    for (const item of n.clauses) {
      const c = object(item);
      const condition = e(c.condition);
      if (typeof condition !== 'boolean') throw new Error('La condizione di when deve essere booleana');
      if (condition) return e(c.components);
    }
    throw new Error('Nessuna clausola when soddisfatta');
  }]
]);
for (const [type, compare] of [
  ['greaterThan', (a: number, b: number) => a > b],
  ['greaterThanEquals', (a: number, b: number) => a >= b],
  ['lessThan', (a: number, b: number) => a < b],
  ['lessThanEquals', (a: number, b: number) => a <= b]
] as const) formulaHandlers.set(type, (n, e) => {
  const values = numbers(e(n.components));
  return values.slice(1).every((value, i) => compare(values[i], value));
});

/**
 * Create an evaluator for one immutable value snapshot.
 * @param stats - Source stat definitions in one character/resource scope.
 * @param values - Committed base values, never calculated-value overrides.
 * @param limits - Per-call operation and recursion ceilings.
 * @returns Cached getters for this snapshot; recreate after any edit.
 * @throws On unknown handlers, missing references, cycles, invalid types, or limits.
 * @remarks Resource and lambda scopes share budgets and cycle detection. No `$view`
 * state or object prototypes are exposed. Missing optional path segments return null.
 */
export function createEvaluator(stats: Stat[], values: Record<string, unknown> = {}, limits = { steps: 10000, depth: 64 }, environment: EvaluationEnvironment = {}) {
  const root = new RuntimeResource('root', stats, values, environment.createdAt, environment.variables, environment.overrides);
  const scopes = new Map<string, RuntimeResource>();
  const resources = new Map(environment.resources?.map(r => [r.id, r]));
  const frames: Record<string, unknown>[] = [];
  const cache = new Map<string, unknown>();
  const enumerations = new Map<string, Map<string, EnumerationEntry>>();
  const active: string[] = [];
  let steps = 0;
  let depth = 0;
  /** Resolve and cache one enumerated type; ids must exist as documented. */
  function enumeration(typeId: string, id: string, field: 'name' | 'abbreviation') {
    if (!Array.isArray(environment.enumerations)) throw new Error('Enumerazioni del sistema non disponibili');
    let entries = enumerations.get(typeId);
    if (!entries) {
      entries = new Map(enumerationEntries(environment.enumerations, typeId).map(entry => [entry.id, entry]));
      enumerations.set(typeId, entries);
    }
    const entry = entries.get(id);
    if (!entry) throw new Error(`Voce di enumerazione mancante: ${typeId}.${id}`);
    const value = field === 'name' ? entry.name : entry.abbreviation;
    if (typeof value !== 'string') throw new Error(`Abbreviazione di enumerazione mancante: ${typeId}.${id}`);
    return value;
  }
  function bounded<T>(fn: () => T): T {
    if (++steps > limits.steps || depth >= limits.depth) throw new Error('Limite di valutazione superato');
    depth++;
    try { return fn(); } finally { depth--; }
  }
  function resolveResource(value: unknown) {
    if (value instanceof RuntimeResource) return value;
    if (!isResourceReference(value)) return undefined;
    if (scopes.has(value.resourceId)) return scopes.get(value.resourceId);
    const record = resources.get(value.resourceId);
    const definition = environment.resourceDefinitions?.find(d => d.id === record?.definitionId);
    if (!record || !definition) throw new MissingStat(`Risorsa mancante: ${value.resourceId}`);
    const scope = new RuntimeResource(`resource:${record.id}`, definition.stats, record.values, record.createdAt, {}, {}, record.id);
    scopes.set(record.id, scope);
    return scope;
  }
  function evaluate(value: unknown, scope = root): unknown {
    return bounded(() => {
      const n = formula(value);
      const handler = formulaHandlers.get(n.type);
      if (!handler) throw new Error(`Formula non supportata: ${n.type}`);
      const result = handler(n, v => evaluate(v, scope), (id, bypass) => getPath(id, scope, false, bypass), {
        scoped(key, item, component) {
          frames.push({ [key]: item });
          try { return evaluate(component, scope); } finally { frames.pop(); }
        },
        defined(path) {
          try { return getPath(path, scope, true) === true; }
          catch (error) { if (error instanceof MissingStat) return false; throw error; }
        },
        roll(expression) {
          if (!environment.roll) throw new Error('roll richiede un comando esplicito; non viene eseguito durante il rendering');
          const total = environment.roll(expression);
          if (!Number.isSafeInteger(total)) throw new Error('Risultato dadi non valido');
          return total;
        },
        enumeration
      });
      if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('Risultato numerico non finito');
      return result;
    });
  }
  function getPath(path: string, scope: RuntimeResource, presence = false, bypass = false): unknown {
    const parts = statPath(path);
    let value: unknown;
    for (let i = 0; i < parts.length; i++) {
      const { id, optional } = parts[i];
      const last = i === parts.length - 1;
      try {
        if (i === 0) {
          const frame = [...frames].reverse().find(f => Object.hasOwn(f, id));
          value = frame ? (presence && last ? true : frame[id]) : get(scope, id, presence && last, bypass);
        } else {
          const nested = resolveResource(value);
          if (nested) value = get(nested, id, presence && last, bypass);
          else if (value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, id))
            value = presence && last ? true : object(value)[id];
          else throw new MissingStat(`Statistica mancante nel percorso: ${path}`);
        }
        if (value == null && optional && !presence) return null;
        if (value == null && optional && presence) return false;
      } catch (error) {
        if (optional && error instanceof MissingStat) return presence ? false : null;
        throw error;
      }
    }
    return value;
  }
  function get(scope: RuntimeResource, id: string, presence = false, bypass = false): unknown {
    return bounded(() => {
      if (Object.hasOwn(scope.variables, id)) return presence ? true : scope.variables[id];
      if (Object.hasOwn(environment.variables ?? {}, id)) return presence ? true : environment.variables?.[id];
      const s = scope.stats.find(s => s.id === id);
      if (!s && id === 'id' && scope.instanceId) return presence ? true : scope.instanceId;
      if (!s && id === 'created_at' && scope.createdAt) return presence ? true : scope.createdAt;
      if (!s) throw new MissingStat(`Statistica mancante: ${id}`);
      if (presence) return true;
      const key = `${scope.key}:${id}`;
      if (!bypass && !frames.length && cache.has(key)) return cache.get(key);
      if (active.includes(key)) throw new Error(`Dipendenza circolare: ${[...active, key].join(' → ')}`);
      active.push(key);
      try {
        let result: unknown;
        if (Object.hasOwn(scope.overrides, id)) result = scope.overrides[id];
        else if (s.type === 'base') result = Object.hasOwn(scope.values, id) ? scope.values[id] : s.default_value;
        else if (s.type === 'calculated') result = evaluate(s.components, scope);
        else throw new Error(`Tipo statistica non supportato: ${s.type}`);
        const resourceResult = s.value_type === 'resource' && result instanceof RuntimeResource;
        const resourceArray = s.value_type === 'array' && s.sub_value_type === 'resource' && Array.isArray(result)
          && result.every(v => v instanceof RuntimeResource || isResourceReference(v));
        if (!resourceResult && !resourceArray && !matchesType(result, s.value_type, s.sub_value_type)) throw new Error(`Valore non valido per ${s.value_type}`);
        if (!frames.length && !bypass) cache.set(key, result);
        return result;
      } catch (error) {
        if (error instanceof MissingStat) throw error;
        throw new Error(`${id}: ${error instanceof Error ? error.message : String(error)}`);
      } finally { active.pop(); }
    });
  }
  return {
    get(id: string) { steps = 0; depth = 0; return getPath(id, root); },
    evaluate(value: unknown) { steps = 0; depth = 0; return evaluate(value); }
  };
}
