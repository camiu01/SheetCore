/** @file Original MIT fixture for resource scopes, photos and encounter lifecycle. */
import { demo } from '../../src/demo';
import type { Stat } from '../../src/domain/model';
export const constant = (value: unknown, value_type = typeof value === 'number' ? 'integer' : typeof value === 'boolean' ? 'bool' : 'string') => ({ type: 'constant', value, value_type });
export const stat = (id: string) => ({ type: 'stat', stat: id });
export const list = (...components: unknown[]) => ({ type: 'list', components });
export const base = (id: string, value_type: string, default_value: unknown, sub_value_type?: string): Stat =>
  ({ id, name: id, type: 'base', value_type, default_value, ...(sub_value_type ? { sub_value_type } : {}) });
export const capabilitySystem = {
  ...demo, id: 'capabilities-original', name: 'Laboratorio originale',
  character_stats: [...demo.character_stats, base('portrait', 'photo', { url: null, base64: null }),
    base('companions', 'array', [], 'resource'), base('origin', 'resource', null),
    base('words', 'array', [], 'string')],
  resources: [...demo.resources, {
    id: 'scout', name: 'Esploratore', stats: [base('name', 'string', 'Sentinella'), base('hp', 'integer', 6), base('initiative', 'integer', 2)]
  }],
  combat_system: {
    stats: [{
      id: 'roster_size', name: 'Partecipanti', type: 'calculated', value_type: 'integer',
      components: { type: 'length', components: stat('$combatants') }
    }],
    combatant_types: [{
      id: 'scout', name: 'Esploratore', template_resource_id: null, instance_resource_id: 'scout', side: 'gruppo', shows_in_party: true,
      on_create: { type: 'sequence', synchronous: true, effects: [{
        type: 'setStat', stat: 'hp', aggregation_type: 'set', new_value: { type: 'roll', formula: constant('1d6') }
      }] }
    }, {
      id: 'hero', name: 'Personaggio', template_resource_id: 'character', instance_resource_id: null, side: 'gruppo',
      shows_in_party: true
    }],
    initiative_system: {
      when_to_set: 'perCombat', has_turns: true, roll_formula: constant('1d6'),
      initiative_modifier: constant(0), initiative_tie_breakers: []
    },
    difficulty_levels: [{ id: 'calm', name: 'Calma' }]
  }
};
