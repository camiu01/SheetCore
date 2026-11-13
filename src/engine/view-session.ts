/** @file Scoped input drafts and source validation, independent of React/storage. */
import { view, type Stat, type View } from '../domain/model';
import { createEvaluator, statPath, type EvaluationEnvironment } from './formulas';

/** Walk only the current form; nested popups own independent sessions. */
export function sessionViews(input: unknown): View[] {
  const result: View[] = [], ids = new Set<string>();
  function walk(input: unknown, depth: number) {
    if (depth > 64 || result.length >= 10000) throw new Error('Vista troppo complessa');
    const node = view(input);
    if (ids.has(node.id)) throw new Error(`ID vista duplicato: ${node.id}`);
    ids.add(node.id); result.push(node);
    for (const field of ['subviews', 'header', 'content', 'center_content', 'bottom_left_stack', 'bottom_right_stack'])
      if (Array.isArray(node[field])) node[field].forEach(v => walk(v, depth + 1));
    for (const field of ['header_view', 'left_view']) if (node[field]) walk(node[field], depth + 1);
  }
  walk(input, 0); return result;
}
/** Identify writable direct fields. Nested paths require a separate resource form. */
export function inputStat(node: View, stats: Stat[]) {
  const id = node.type === 'avatar' ? node.photo_stat
    : node.type === 'resourceSection' ? node.resource_set_stat ?? node.resource_stat
    : node.edit_stat ?? (['stat', 'checkbox', 'selectResources', 'ticker', 'select', 'resource', 'resourceArray'].includes(node.type) ? node.stat : undefined);
  return stats.find(s => s.id === id && s.type === 'base');
}
/** Seed only real writable input IDs; subsequent edits stay session-local. */
export function initialDrafts(input: unknown, stats: Stat[], values: Record<string, unknown>) {
  return Object.fromEntries(sessionViews(input).flatMap(v => {
    const s = inputStat(v, stats);
    return s ? [[v.id, Object.hasOwn(values, s.id) ? values[s.id] : s.default_value ?? null]] : [];
  }));
}
/** Explicit manual projection: retain input nodes, not official page visibility/hooks. */
export function manualFieldGroup(group: View): View {
  if (!Array.isArray(group.content)) throw new Error('Gruppo di campi non valido');
  return { id: `polysheet-manual-${group.id}`, type: 'list', subviews: group.content, validation_message: group.validation_message };
}
/** Find original calculations whose direct $view dependencies exist in this form. */
export function draftCalculations(stats: Stat[], drafts: Record<string, unknown>) {
  return stats.filter(s => {
    if (s.type !== 'calculated') return false;
    const keys: string[] = [];
    function visit(value: unknown) {
      if (!value || typeof value !== 'object') return;
      if ('type' in value && value.type === 'constant') return;
      if ('type' in value && value.type === 'stat' && 'stat' in value && typeof value.stat === 'string') {
        const path = statPath(value.stat);
        if (path[0].id === '$view' && path[1]) keys.push(path[1].id);
      }
      Object.values(value).forEach(visit);
    }
    visit(s.components);
    return keys.length > 0 && keys.every(key => Object.hasOwn(drafts, key));
  });
}
/** Every validation must yield null or a visible string; failures block Save. */
export function validationMessages(input: unknown, stats: Stat[], values: Record<string, unknown>, drafts: Record<string, unknown>, environment: EvaluationEnvironment = {}) {
  const e = createEvaluator(stats, values, undefined, { ...environment, variables: { ...environment.variables, $view: drafts } });
  // Imported view IDs must never resolve or overwrite inherited object properties.
  const result: Record<string, string> = Object.create(null);
  for (const v of sessionViews(input)) {
    if (v.validation_message == null) continue;
    try {
      const message = e.evaluate(v.validation_message);
      if (message !== null && typeof message !== 'string') throw new Error('validation_message deve restituire testo o null');
      if (message !== null) result[v.id] = message || 'Valore non valido.';
    } catch (error) { result[v.id] = error instanceof Error ? error.message : String(error); }
  }
  return result;
}
