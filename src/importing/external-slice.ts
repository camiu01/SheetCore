/**
 * @file Explicit test-only projection of the pinned historical 5e source.
 * @remarks This is not a compiler or merge algorithm. Selected source objects are
 * copied unchanged. Unrelated stats, views, and rule subsystems are removed.
 * This module is not imported by the PWA, so no external content ships with it.
 */
import type { SystemDefinition } from '../domain/model';

/** Exact IDs covered by the external vertical-slice expectations. */
export const abilityIds = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

/**
 * Select six ability scores/modifiers, name, the original abilities section,
 * and the note resource. Keep unknown root metadata and original search view,
 * but explicitly remove unrelated creation, progression, mechanics and enums.
 * @throws If the pinned expected objects are not present.
 */
export function externalSlice(source: SystemDefinition): SystemDefinition {
  const ids = new Set(['name', ...abilityIds.flatMap(id => [`${id}_score`, `${id}_modifier`])]);
  const stats = source.character_stats.filter(s => ids.has(s.id));
  const sections = source.character_sheet_sections.filter(s => s.id === 'abilities');
  const resources = source.resources.filter(r => r.id === 'note');
  if (stats.length !== 13 || sections.length !== 1 || resources.length !== 1) throw new Error('Pinned external subset has drifted');
  return {
    ...source, id: `${source.id}-sheetcore-slice`, name: `${source.name} · verified ability slice`,
    character_stats: stats, character_sheet_sections: sections, resources,
    character_indexed_stats: ['name'], character_creation_flow: [],
    progression_systems: {}, mechanics: [], enumerated_types: []
  };
}
