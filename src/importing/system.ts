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
import { it } from '../ui/it';

export const MAX_SYSTEM_BYTES = 8 * 1024 * 1024;
/** Renderer field allowlist; unhandled fields remain in the original document. */
export const viewFields: Record<string, string[]> = {
  text: ['text', 'edit_stat', 'style', 'label', 'hint', 'max_length', 'bold', 'max_lines', 'signed', 'color', 'resource_id', 'resource_instance_ids_stat', 'resource_display_stat'],
  stat: ['stat', 'edit_stat', 'change_amount', 'min_value_allowed', 'max_value_allowed', 'style', 'always_show_sign', 'override_label'],
  section: ['header', 'content', 'show_divider', 'collapsible', 'start_collapsed', 'always_show_collapse_icon', 'content_item_min_width', 'alignment'],
  list: ['subviews', 'padding', 'padding_top', 'padding_right', 'padding_bottom', 'padding_left', 'alignment'],
  composite: ['subviews', 'alignment', 'row_only'],
  divider: [], spacer: [], checkbox: ['stat', 'label', 'enabled', 'label_alignment', 'style'],
  avatar: ['photo_stat', 'name_stat', 'interactable', 'preview_enabled', 'size'],
  avatarSection: ['center_content', 'bottom_left_stack', 'bottom_right_stack', 'bottom_left_button_title', 'bottom_right_button_title'],
  icon: ['name', 'size', 'color'],
  selectResources: ['stat', 'resource_id', 'view_type', 'preserve_ids', 'should_append', 'should_save_on_selection', 'create_in_place', 'inline_creation_mode', 'creation_pop_up_type'],
  resourceSection: ['resource_stat', 'resource_set_stat', 'resource_id', 'header_view', 'read_only', 'tap_displays_resource', 'max_items_in_preview', 'reorganizable', 'content_item_min_width', 'alignment'],
  popUpButton: ['text', 'icon', 'pop_up_title', 'pop_up_view', 'display_cancel_button', 'cancel_text', 'display_save_button', 'save_text', 'should_persist_on_save', 'pop_up_type'],
  chip: ['text', 'background_color', 'border_color', 'style', 'resource_id', 'resource_instance_ids_stat', 'resource_display_stat'],
  listItem: ['title', 'subtitle', 'first_line_extra', 'second_line_extra', 'title_color', 'subtitle_color', 'first_line_extra_color', 'second_line_extra_color'],
  collapsible: ['title', 'subtitle', 'subviews', 'start_expanded'],
  viewPager: ['subviews', 'names', 'color'],
  ticker: ['stat', 'style', 'button_location', 'button_look', 'change_amount', 'allowed_values', 'min_value_allowed', 'max_value_allowed', 'calculated_min_value_allowed', 'calculated_max_value_allowed', 'label', 'label_alignment', 'should_auto_save', 'always_show_sign', 'hide_value', 'edit_bottom_sheet_title'],
  button: ['text', 'enabled'],
  select: ['stat', 'meta_stat', 'options', 'allowed_options', 'resource_options', 'resource_saved_stat', 'max_selection_amount', 'options_display_stat', 'multi_select', 'style', 'should_auto_save'],
  menuButton: ['icon_name', 'icon_size', 'icon_color', 'options', 'allowed_options'],
  resource: ['resource_id', 'stat', 'view_type'],
  resourceArray: ['resource_id', 'stat', 'left_view', 'pop_up_type', 'pop_up_button_text', 'view_type', 'hide_line', 'auto_add_first', 'allow_adds_and_removes']
};
const commonViewFields = ['type', 'id', 'is_visible', 'validation_message', 'margin_left', 'margin_right', 'margin_top', 'margin_bottom'];
/** Only implemented enum variants may pass the renderer's behavioral boundary. */
export function unsupportedViewOptions(v: Record<string, unknown>): string[] {
  const variants: Record<string, Record<string, string[]>> = {
    icon: { size: ['small', 'medium', 'large'] },
    checkbox: { style: ['checkbox'], label_alignment: ['left', 'right'] },
    chip: { style: ['compact', 'fullSize'] },
    popUpButton: { pop_up_type: ['bottomSheet', 'alert'] },
    selectResources: { view_type: ['list', 'icon'], inline_creation_mode: ['disabled', 'optional', 'only'], creation_pop_up_type: ['bottomSheet', 'window'] },
    collapsible: { start_expanded: ['true', 'false'] },
    viewPager: {},
    ticker: {
      style: ['headline', 'title', 'section', 'subhead', 'text', 'caption'],
      button_location: ['left', 'right', 'sideToSide'], button_look: ['plusMinus', 'upDown'],
      label_alignment: ['left', 'right']
    },
    button: {},
    select: { style: ['dropdown', 'list'] },
    menuButton: { icon_size: ['small', 'medium', 'large'] },
    resource: { view_type: ['display', 'edit', 'list'] },
    resourceArray: { view_type: ['display', 'edit', 'list'], pop_up_type: ['bottomSheet', 'window'] }
  };
  return Object.entries(variants[String(v.type)] ?? {}).filter(([key, values]) => v[key] != null && !values.includes(String(v[key]))).map(([key]) => key);
}
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
/**
 * Collection roots that only an assembled monolithic system contains.
 * @remarks The upstream authoring format keeps them in sibling files/folders.
 */
const monolithicSections = [
  'character_stats', 'character_sheet_sections', 'character_creation_flow',
  'character_search_item_view', 'mechanics', 'resources', 'enumerated_types'
] as const;

/**
 * Recognize an unassembled split authoring root before schema noise is shown.
 * @param parsed - Already bounded and parsed JSON document.
 * @returns True only for a system identity that carries none of the collection
 * roots; partially malformed systems still receive field-level validation.
 */
function splitAuthoringRoot(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const root = object(parsed);
  if (typeof root.id !== 'string' || typeof root.version !== 'string') return false;
  return monolithicSections.every(key => root[key] == null);
}

/** Validate the monolithic structure and report semantic/compatibility issues. */
export function parseSystem(original: string): { definition: SystemDefinition; diagnostics: Diagnostic[] } {
  const parsed = boundedJson(original);
  if (splitAuthoringRoot(parsed)) throw new Error(it.authoringRoot);
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
          const contexts = ['created_at', '$view', '$resource', '$combatants', '$combat', '$combat_difficulty', '$combatant', '$combatant_type', '$template_resource_id', '$instance_resource_id', '$edit_mode'];
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
      if (type === 'sortBy' && !['asc', 'desc'].includes(String(node.order)))
        report(`${path}.order`, 'Ordine sortBy richiesto: asc o desc.', 'error');
      if ((type === 'enumeratedName' || type === 'enumeratedAbbreviation') &&
          (typeof node.enumerated_type !== 'string' || !node.enumerated_type))
        report(`${path}.enumerated_type`, 'Tipo di enumerazione richiesto', 'error');
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
    } else if (['add', 'subtract', 'multiply', 'divide', 'and', 'or', 'isEmpty', 'isNull', 'notNull', 'toLowerCase', 'sortBy', 'findFirst', 'flatMap', 'concat', 'trim', 'date', 'max', 'min', 'map', 'filter', 'defaultIfNull', 'joinToString', 'equals', 'notEquals', 'length', 'not', 'greaterThan', 'greaterThanEquals', 'lessThan', 'lessThanEquals', 'toNum', 'toSignedString'].includes(type)) {
      report(`${path}.components`, 'Formula components richiesta (non una lista JSON diretta)', 'error');
    }
    for (const field of ['mapper', 'filter', 'sort_by_selector', 'haystack', 'needle', 'default_components', 'meta_stat', 'formula', 'string', 'occurrence', 'replace', 'id']) {
      if (!formulaFields[type]?.includes(field)) continue;
      if (type === 'findFirst' && field === 'filter' && node.filter == null) continue;
      let inner = bindings;
      if (field === 'mapper' || field === 'filter' || field === 'sort_by_selector') {
        const keyField = field === 'mapper' ? 'map_value_key' : field === 'sort_by_selector' ? 'sort_by_value_key' : type === 'findFirst' ? 'find_first_value_key' : 'filter_value_key';
        const fallback = field === 'mapper' ? '$mapValue' : field === 'sort_by_selector' ? '$sortByValue' : type === 'findFirst' ? '$findFirstValue' : '$filterValue';
        const key = node[keyField] ?? fallback;
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
    for (const key of unsupportedViewOptions(v)) report(`${path}.${key}`, `Opzione non supportata: ${String(v[key])}`);
    if (v.type === 'popUpButton' && v.icon != null && object(v.icon).type !== 'icon')
      report(`${path}.icon`, 'popUpButton richiede una vista icon.');
    for (const field of ['text', 'label', 'hint', 'is_visible', 'validation_message', 'enabled', 'override_label', 'pop_up_title', 'save_text', 'cancel_text', 'bottom_left_button_title', 'bottom_right_button_title', 'title', 'subtitle', 'first_line_extra', 'second_line_extra', 'title_color', 'subtitle_color', 'first_line_extra_color', 'second_line_extra_color',
      'names', 'allowed_values', 'calculated_min_value_allowed', 'calculated_max_value_allowed', 'meta_stat', 'allowed_options', 'resource_options', 'max_selection_amount', 'pop_up_button_text'])
      if (v[field] != null) checkFormula(v[field], `${path}.${field}`, stats, ['$view']);
    // `viewPager.color` is a formula; icon, text and chip colours are literal palette values.
    if (v.type === 'viewPager' && v.color != null) checkFormula(v.color, `${path}.color`, stats, ['$view']);
    for (const field of ['stat', 'edit_stat', 'photo_stat', 'name_stat']) if (v[field] != null) {
      if (typeof v[field] !== 'string') report(`${path}.${field}`, 'ID statistica richiesto', 'error');
      else if (!stats.some(s => s.id === v[field])) report(`${path}.${field}`, `Riferimento non risolto: ${v[field]}`);
    }
    for (const field of ['subviews', 'header', 'content', 'center_content', 'bottom_left_stack', 'bottom_right_stack']) {
      if (v[field] != null && !Array.isArray(v[field])) report(`${path}.${field}`, 'Lista di viste richiesta', 'error');
      if (Array.isArray(v[field])) v[field].forEach((c, i) => checkView(c, `${path}.${field}[${i}]`, stats));
    }
    for (const field of ['pop_up_view', 'icon', 'header_view', 'left_view']) if (v[field] != null) checkView(v[field], `${path}.${field}`, stats);
    if (['list', 'composite', 'collapsible', 'viewPager'].includes(v.type) && !Array.isArray(v.subviews)) report(`${path}.subviews`, 'Lista richiesta', 'error');
    if (v.type === 'section' && (!Array.isArray(v.header) || !Array.isArray(v.content))) report(path, 'header e content richiesti', 'error');
    if (v.type === 'viewPager') {
      const names = object(v.names ?? {});
      const components = Array.isArray(names.components) ? names.components : [];
      if (names.type !== 'list' || components.length !== (Array.isArray(v.subviews) ? v.subviews.length : 0))
        report(`${path}.names`, 'Nomi delle pagine richiesti: una costante per ogni subview.', 'error');
    }
    if (['resource', 'resourceArray'].includes(v.type) && !system.resources.some(r => r.id === v.resource_id))
      report(`${path}.resource_id`, `Tipo di risorsa non risolto: ${String(v.resource_id)}`);
    if (['ticker', 'select', 'resource', 'resourceArray'].includes(v.type) && typeof v.stat !== 'string')
      report(`${path}.stat`, 'Campo base richiesto', 'error');
    if (v.type === 'menuButton' && typeof v.options !== 'string')
      report(`${path}.options`, 'Enumerazione richiesta', 'error');
    if (v.type === 'select' && typeof v.options !== 'string' && v.resource_options == null && v.meta_stat == null)
      report(`${path}.options`, 'Sorgente delle opzioni richiesta', 'error');
    if (v.type === 'button' && (v.event != null || v.event_names != null))
      report(`${path}.event`, 'Evento del pulsante non eseguito da PolySheet.');
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
  if (system.character_creation_flow.length) {
    report('$.character_creation_flow', 'Flusso ufficiale ed eventi non eseguiti. Disponibili gruppi di campi sorgente in modifica manuale.');
    system.character_creation_flow.forEach((page, i) => {
      if (page && typeof page === 'object' && object(page).view)
        checkView(object(page).view, `$.character_creation_flow[${i}].view`, system.character_stats);
    });
  }
  if (system.mechanics.length) report('$.mechanics', `${system.mechanics.length} meccaniche non eseguite: il sistema non è pienamente utilizzabile.`);
  if (Object.keys(system.progression_systems).length) report('$.progression_systems', 'Progressione automatica non supportata.');
  if (system.enumerated_types.length) report('$.enumerated_types', 'Enumerazioni usate da select, menuButton e dalle formule enumerated; le chip dinamiche non sono ancora interpretate.');
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
