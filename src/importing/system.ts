/**
 * @file Untrusted JSON boundary and conservative compatibility diagnostics.
 * @remarks Split sources and RPGScript are excluded. The verified gzip-JSON
 * package adapter performs decompression before reaching this JSON boundary.
 * @see https://docs.rpg-companion.app/GettingStarted/SystemCreation
 */
import { formulaFields, formulaHandlers, statPath } from '../engine/formulas';
import {
  matchesType, object, systemSchema, type Diagnostic, type Stat,
  type StoredSystem, type SystemDefinition
} from '../domain/model';

export const MAX_SYSTEM_BYTES = 8 * 1024 * 1024;
/** Renderer field allowlist; unhandled fields remain in the original document. */
export const viewFields: Record<string, string[]> = {
  text: ['text', 'edit_stat', 'style', 'label', 'hint', 'max_length', 'bold'],
  stat: ['stat', 'edit_stat', 'change_amount', 'min_value_allowed', 'max_value_allowed', 'style', 'always_show_sign', 'override_label'],
  section: ['header', 'content', 'show_divider', 'collapsible', 'start_collapsed', 'content_item_min_width', 'alignment'],
  list: ['subviews', 'padding', 'alignment'],
  composite: ['subviews', 'alignment', 'row_only'],
  divider: [], spacer: [], checkbox: ['stat', 'label', 'enabled'],
  avatar: ['photo_stat', 'name_stat', 'interactable', 'preview_enabled', 'size']
};
const commonViewFields = ['type', 'id', 'is_visible', 'margin_left', 'margin_right', 'margin_top', 'margin_bottom'];
const supportedValues = new Set(['string', 'integer', 'decimal', 'bool', 'array', 'resource', 'photo']);
/** Decode exact UTF-8, retaining a BOM; never silently replace malformed bytes. */
export function decodeUtf8(bytes: BufferSource): string {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('Il file deve contenere JSON con codifica UTF-8 valida.'); }
}
/**
 * Parse JSON with byte, node, depth, and prototype-key limits before validation.
 * @throws On malformed, oversized, excessively nested, or unsafe documents.
 */
export function boundedJson(text: string, maxBytes = MAX_SYSTEM_BYTES): unknown {
  if (new TextEncoder().encode(text).length > maxBytes) throw new Error(`$: file troppo grande (massimo ${maxBytes / 1024 / 1024} MB)`);
  let parsed: unknown;
  try { parsed = JSON.parse(text.startsWith('\ufeff') ? text.slice(1) : text); } catch { throw new Error('$: JSON malformato. Controlla virgole e parentesi.'); }
  let nodes = 0;
  function visit(value: unknown, depth: number) {
    if (++nodes > 400000 || depth > 64) throw new Error('$: documento troppo complesso (400.000 nodi, profondità 64)');
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`$: chiave vietata ${key}`);
        visit(child, depth + 1);
      }
    }
  }
  visit(parsed, 0);
  return parsed;
}
/** Validate the monolithic structure and report semantic/compatibility issues. */
export function parseSystem(original: string): { definition: SystemDefinition; diagnostics: Diagnostic[] } {
  const parsed = boundedJson(original);
  const result = systemSchema.safeParse(parsed);
  if (!result.success) throw new Error(result.error.issues.slice(0, 12).map(i => `$.${i.path.join('.')}: ${i.message}`).join('\n'));
  const definition = result.data;
  const diagnostics = diagnose(definition);
  return { definition, diagnostics };
}
/** Walk interpreted contexts, checking references, cycles, and unsupported fields. */
export function diagnose(system: SystemDefinition): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const report = (path: string, message: string, severity: Diagnostic['severity'] = 'warning') => {
    diagnostics.push({ path, message, severity });
  };
  function unique(items: { id: string }[], path: string) {
    const ids = new Set<string>();
    items.forEach((s, i) => {
      if (ids.has(s.id)) report(`${path}[${i}].id`, `ID duplicato: ${s.id}`, 'error');
      ids.add(s.id);
    });
  }
  function fields(value: Record<string, unknown>, allowed: string[], path: string) {
    for (const key of Object.keys(value)) if (!allowed.includes(key))
      report(`${path}.${key}`, 'Campo conservato, ma non interpretato in questo incremento.');
  }
  function checkFormula(input: unknown, path: string, stats: Stat[], bindings: string[] = [], allowRoll = false) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof object(input).type !== 'string') {
      report(path, 'Albero formula non valido', 'error'); return;
    }
    const node = object(input), type = String(node.type);
    if (!formulaHandlers.has(type)) report(`${path}.type`, `Formula non supportata: ${type}`);
    else {
      fields(node, ['type', ...formulaFields[type]], path);
      if (type === 'constant' && (typeof node.value_type !== 'string' || !Object.hasOwn(node, 'value') ||
          !matchesType(node.value, node.value_type, typeof node.sub_value_type === 'string' ? node.sub_value_type : undefined)))
        report(path, 'Costante con tipo o valore non valido', 'error');
      if (type === 'stat' || type === 'defined') {
        if (typeof node.stat !== 'string') report(`${path}.stat`, 'Riferimento richiesto', 'error');
        else try {
          const first = statPath(node.stat)[0];
          const contexts = ['created_at', '$resource', '$combatants', '$combat', '$combat_difficulty', '$combatant', '$combatant_type', '$template_resource_id', '$instance_resource_id'];
          if (!stats.some(s => s.id === first.id) && !bindings.includes(first.id) && !contexts.includes(first.id) && !first.optional && type !== 'defined')
            report(`${path}.stat`, `Riferimento mancante o contesto non disponibile: ${node.stat}`);
        } catch (error) { report(`${path}.stat`, error instanceof Error ? error.message : String(error), 'error'); }
        if (type === 'stat' && node.ignore_cache != null && typeof node.ignore_cache !== 'boolean')
          report(`${path}.ignore_cache`, 'Valore booleano richiesto', 'error');
      }
      if (type === 'roll' && !allowRoll) report(path, 'roll viene eseguito solo nei comandi espliciti di combattimento, non durante il rendering.');
      if (type === 'flatAppend' && node.treat_as_set != null && typeof node.treat_as_set !== 'boolean')
        report(`${path}.treat_as_set`, 'Valore booleano richiesto', 'error');
      if (type === 'divide' && !['down', 'up', 'none'].includes(String(node.rounding_method)))
        report(`${path}.rounding_method`, 'Supportati solo down, up, none espliciti; closest non verificato.');
    }
    if (type === 'list' || type === 'flatAppend') {
      if (!Array.isArray(node.components)) report(`${path}.components`, 'Lista richiesta', 'error');
      else node.components.forEach((c, i) => checkFormula(c, `${path}.components[${i}]`, stats, bindings, allowRoll));
    } else if (type === 'when') {
      if (!Array.isArray(node.clauses)) report(`${path}.clauses`, 'Lista di clausole richiesta', 'error');
      else node.clauses.forEach((c, i) => {
        if (!c || typeof c !== 'object') { report(`${path}.clauses[${i}]`, 'Clausola non valida', 'error'); return; }
        const clause = object(c);
        checkFormula(clause.condition, `${path}.clauses[${i}].condition`, stats, bindings, allowRoll);
        checkFormula(clause.components, `${path}.clauses[${i}].components`, stats, bindings, allowRoll);
      });
    } else if (Object.hasOwn(node, 'components') && !Array.isArray(node.components)) {
      checkFormula(node.components, `${path}.components`, stats, bindings, allowRoll);
    } else if (['add', 'subtract', 'multiply', 'divide', 'and', 'or', 'isEmpty', 'concat', 'trim', 'date', 'max', 'min', 'map', 'filter', 'defaultIfNull', 'joinToString', 'equals', 'notEquals', 'length', 'not', 'greaterThan', 'greaterThanEquals', 'lessThan', 'lessThanEquals'].includes(type)) {
      report(`${path}.components`, 'Formula components richiesta (non una lista JSON diretta)', 'error');
    }
    for (const field of ['mapper', 'filter', 'default_components', 'meta_stat', 'formula']) {
      if (!formulaFields[type]?.includes(field)) continue;
      let inner = bindings;
      if (field === 'mapper' || field === 'filter') {
        const key = node[field === 'mapper' ? 'map_value_key' : 'filter_value_key'] ?? (field === 'mapper' ? '$mapValue' : '$filterValue');
        if (typeof key !== 'string' || !/^\$?[\w-]+$/.test(key)) report(path, 'Chiave contestuale non valida', 'error');
        else inner = [...bindings, key];
      }
      checkFormula(node[field], `${path}.${field}`, stats, inner, allowRoll);
    }
  }
  function checkView(input: unknown, path: string, stats: Stat[]) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) { report(path, 'Vista non valida', 'error'); return; }
    const v = object(input);
    if (typeof v.id !== 'string' || typeof v.type !== 'string') { report(path, 'Vista senza id o type', 'error'); return; }
    const allowed = viewFields[v.type];
    if (!allowed) report(`${path}.type`, `Componente non supportato: ${v.type}`);
    else fields(v, [...commonViewFields, ...allowed], path);
    for (const field of ['text', 'label', 'hint', 'is_visible', 'enabled', 'override_label'])
      if (v[field] != null) checkFormula(v[field], `${path}.${field}`, stats);
    for (const field of ['stat', 'edit_stat', 'photo_stat', 'name_stat']) if (v[field] != null) {
      if (typeof v[field] !== 'string') report(`${path}.${field}`, 'ID statistica richiesto', 'error');
      else if (!stats.some(s => s.id === v[field])) report(`${path}.${field}`, `Riferimento non risolto: ${v[field]}`);
    }
    for (const field of ['subviews', 'header', 'content']) {
      if (v[field] != null && !Array.isArray(v[field])) report(`${path}.${field}`, 'Lista di viste richiesta', 'error');
      if (Array.isArray(v[field])) v[field].forEach((c, i) => checkView(c, `${path}.${field}[${i}]`, stats));
    }
    if (['list', 'composite'].includes(v.type) && !Array.isArray(v.subviews)) report(`${path}.subviews`, 'Lista richiesta', 'error');
    if (v.type === 'section' && (!Array.isArray(v.header) || !Array.isArray(v.content))) report(path, 'header e content richiesti', 'error');
  }
  function checkStats(stats: Stat[], path: string) {
    unique(stats, path);
    for (const [i, stat] of stats.entries()) {
      const p = `${path}[${i}]`;
      if (!supportedValues.has(stat.value_type)) report(`${p}.value_type`, `Tipo non modificabile: ${stat.value_type}`);
      if (stat.type === 'base') {
        if (!Object.hasOwn(stat, 'default_value')) report(`${p}.default_value`, 'Valore predefinito richiesto', 'error');
        else if (supportedValues.has(stat.value_type) && !matchesType(stat.default_value, stat.value_type, stat.sub_value_type))
          report(`${p}.default_value`, 'Valore non conforme al tipo', 'error');
      } else if (stat.type === 'calculated') checkFormula(stat.components, `${p}.components`, stats);
      else report(`${p}.type`, `Tipo statistica non supportato: ${stat.type}`);
      if (stat.value_type === 'array' && stat.type === 'base' && !['string', 'integer', 'decimal', 'bool', 'resource'].includes(stat.sub_value_type ?? ''))
        report(`${p}.sub_value_type`, 'Editor liste disponibile per string, integer, decimal, bool e resource.');
      // The compiled translatable marker permits localized names. With no supplied
      // translation catalogue, the source name is the explicit fallback.
      fields(stat, ['id', 'name', 'plural', 'abbreviation', 'translatable', 'type', 'value_type', 'sub_value_type', 'default_value', 'components', 'party_visible', 'resource_type'], p);
    }
    const graph = new Map<string, string[]>();
    function refs(n: unknown, found: string[]) {
      if (!n || typeof n !== 'object') return;
      if (!Array.isArray(n)) {
        const o = object(n);
        if (o.type === 'constant' || o.type === 'defined') return;
        if (o.type === 'stat' && typeof o.stat === 'string') {
          const first = o.stat.split('.')[0].replace(/\?$/, '');
          if (stats.some(s => s.id === first)) found.push(first);
          return;
        }
      }
      Object.values(n).forEach(v => refs(v, found));
    }
    stats.forEach(s => { const dependencies: string[] = []; refs(s.components, dependencies); graph.set(s.id, dependencies); });
    const visited = new Set<string>(), stack = new Set<string>();
    function dfs(id: string, depth: number) {
      if (stack.has(id)) { report(path, `Dipendenza circolare: ${[...stack, id].join(' → ')}`, 'error'); return; }
      if (visited.has(id)) return;
      if (depth > 64) { report(path, `Catena dipendenze troppo profonda: ${id}`, 'error'); return; }
      stack.add(id);
      graph.get(id)?.forEach(next => dfs(next, depth + 1));
      stack.delete(id); visited.add(id);
    }
    stats.forEach(s => dfs(s.id, 0));
  }
  fields(system, [
    'type', 'id', 'name', 'abbreviation', 'version', 'min_app_version', 'character_display_name',
    'character_stats', 'character_sheet_sections', 'character_creation_flow', 'character_indexed_stats',
    'character_search_item_view', 'progression_systems', 'mechanics', 'resources', 'enumerated_types', 'dice', 'combat_system'
  ], '$');
  checkStats(system.character_stats, '$.character_stats');
  unique(system.character_sheet_sections, '$.character_sheet_sections');
  unique(system.resources, '$.resources');
  unique(system.dice ?? [], '$.dice');
  system.character_sheet_sections.forEach((s, i) => checkView(s.view, `$.character_sheet_sections[${i}].view`, system.character_stats));
  checkView(system.character_search_item_view, '$.character_search_item_view', system.character_stats);
  if (system.character_creation_flow.length) report('$.character_creation_flow', 'Flusso ufficiale non eseguito. Disponibile soltanto creazione manuale.');
  if (system.mechanics.length) report('$.mechanics', `${system.mechanics.length} meccaniche non eseguite: il sistema non è pienamente utilizzabile.`);
  if (Object.keys(system.progression_systems).length) report('$.progression_systems', 'Progressione automatica non supportata.');
  if (system.enumerated_types.length) report('$.enumerated_types', 'Enumerazioni conservate, selettori e formule enumerated non supportati.');
  if (!system.dice) report('$.dice', 'Definizioni dadi assenti nella variante storica. Disponibile solo il lanciatore manuale dell’app.');
  system.resources.forEach((r, i) => {
    const p = `$.resources[${i}]`;
    checkStats(r.stats, `${p}.stats`);
    if (r.mechanics?.length) report(`${p}.mechanics`, 'Effetti risorsa non eseguiti. Assegnazione soltanto manuale.');
    fields(r, ['id', 'name', 'plural', 'abbreviation', 'translatable', 'display_name', 'stats', 'display_view', 'edit_view', 'list_view', 'search_item_view', 'mechanics', 'indexed_stats', 'core', 'color'], p);
    for (const field of ['display_view', 'edit_view', 'list_view', 'search_item_view'] as const)
      if (r[field]) checkView(r[field], `${p}.${field}`, r.stats);
  });
  if (system.combat_system) {
    const c = system.combat_system, p = '$.combat_system';
    fields(c, ['type', 'stats', 'combatant_types', 'initiative_system', 'difficulty_levels', 'encounter_resolution_message', 'is_encounter_within_difficulty_level'], p);
    checkStats(c.stats, `${p}.stats`);
    unique(c.combatant_types, `${p}.combatant_types`);
    unique(c.difficulty_levels ?? [], `${p}.difficulty_levels`);
    if (c.encounter_resolution_message) checkFormula(c.encounter_resolution_message, `${p}.encounter_resolution_message`, c.stats);
    if (c.is_encounter_within_difficulty_level) checkFormula(c.is_encounter_within_difficulty_level, `${p}.is_encounter_within_difficulty_level`, c.stats);
    const init = c.initiative_system;
    if (!['perCombat', 'perRound'].includes(init.when_to_set)) report(`${p}.initiative_system.when_to_set`, 'Modalità iniziativa non supportata.');
    if (init.initiative_degrade_per_pass != null && (init.initiative_degrade_per_pass <= 0 || init.min_initiative_to_act == null))
      report(`${p}.initiative_system`, 'Passaggi iniziativa richiedono decremento positivo e soglia minima.', 'error');
    fields(init, ['type', 'when_to_set', 'has_turns', 'roll_formula', 'initiative_modifier', 'initiative_tie_breakers', 'initiative_degrade_per_pass', 'min_initiative_to_act'], `${p}.initiative_system`);
    c.combatant_types.forEach((t, i) => {
      const path = `${p}.combatant_types[${i}]`;
      const stats = t.instance_resource_id ? system.resources.find(r => r.id === t.instance_resource_id)?.stats
        : t.template_resource_id === 'character' ? system.character_stats : system.resources.find(r => r.id === t.template_resource_id)?.stats;
      if (!stats) { report(path, 'Definizione combattente mancante', 'error'); return; }
      fields(t, ['type', 'id', 'name', 'plural', 'abbreviation', 'translatable', 'template_resource_id', 'instance_resource_id', 'side', 'shows_in_party', 'header_view', 'card_view', 'on_create'], path);
      if (t.header_view) checkView(t.header_view, `${path}.header_view`, stats);
      if (t.card_view) checkView(t.card_view, `${path}.card_view`, stats);
      if (init.roll_formula) checkFormula(init.roll_formula, `${p}.initiative_system.roll_formula`, stats);
      checkFormula(init.initiative_modifier, `${p}.initiative_system.initiative_modifier`, stats);
      init.initiative_tie_breakers.forEach((f, n) => checkFormula(f, `${p}.initiative_system.initiative_tie_breakers[${n}]`, stats));
      function effect(value: unknown, at: string) {
        const e = object(value);
        if (e.type === 'sequence') {
          fields(e, ['type', 'effects', 'synchronous'], at);
          if (e.synchronous !== true) report(at, 'Inizializzazione supportata solo con synchronous=true esplicito.');
          if (!Array.isArray(e.effects)) report(at, 'Lista effetti richiesta', 'error');
          else e.effects.forEach((child, n) => effect(child, `${at}.effects[${n}]`));
        } else if (e.type === 'setStat') {
          fields(e, ['type', 'stat', 'meta_stat', 'new_value', 'aggregation_type', 'calculated_aggregation_type'], at);
          if (e.aggregation_type !== 'set') report(at, 'Inizializzazione supportata con override aggregation_type=set.');
          if (e.meta_stat != null || e.calculated_aggregation_type != null) report(at, 'Destinazioni dinamiche e aggregazioni calcolate non supportate in on_create.');
          if (typeof e.stat !== 'string' || !stats?.some(s => s.id === e.stat)) report(at, 'Destinazione diretta inizializzazione richiesta.');
          checkFormula(e.new_value, `${at}.new_value`, stats ?? [], [], true);
        } else report(at, `Effetto inizializzazione non supportato: ${String(e.type)}`);
      }
      if (t.on_create) {
        if (!t.instance_resource_id) report(`${path}.on_create`, 'Inizializzazione eseguita solo per nuove istanze, non su personaggi o risorse collegati.');
        effect(t.on_create, `${path}.on_create`);
      }
    });
  }
  return diagnostics;
}
/**
 * Build an immutable import preview without writing to IndexedDB.
 * @param original - Exact source text retained for export and reproducibility.
 * @param source - Filename or provenance label, not an executable URL.
 */
export async function prepareSystem(original: string, source: string): Promise<StoredSystem> {
  const { definition, diagnostics } = parseSystem(original);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(original));
  const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return { key: `${definition.id}@${definition.version}:${digest}`, definition, original, source, digest, diagnostics, importedAt: new Date().toISOString() };
}
