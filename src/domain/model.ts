/**
 * @file Source-preserving contracts and PolySheet-owned persistence records.
 * @remarks Passthrough schemas retain unknown RPG fields. Character, resource
 * instance, and backup shapes are internal, not RPG Companion exchange formats.
 */
import { z } from 'zod';
import { isPhoto } from './photo';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Node = Record<string, unknown> & { type: string };
export type View = Node & { id: string };
export const nodeSchema = z.object({ type: z.string().min(1) }).passthrough();
export const viewSchema = nodeSchema.extend({ id: z.string().min(1) });
export const statSchema = z.object({
  id: z.string().min(1).max(200), name: z.string().max(500),
  type: z.string(), value_type: z.string(),
  translatable: z.boolean().optional(),
  sub_value_type: z.string().nullable().optional(), resource_type: z.string().nullable().optional(),
  default_value: z.unknown().optional(), components: nodeSchema.optional()
}).passthrough();
/** Declarative combat contracts; unknown additions remain preserved and diagnosed. */
export const combatSchema = z.object({
  stats: z.array(statSchema).max(500),
  combatant_types: z.array(z.object({
    id: z.string().min(1), name: z.string(),
    template_resource_id: z.string().nullable().optional(),
    instance_resource_id: z.string().nullable().optional(),
    side: z.string(), shows_in_party: z.boolean().optional(),
    header_view: viewSchema.nullable().optional(), card_view: viewSchema.nullable().optional(),
    on_create: nodeSchema.nullable().optional()
  }).passthrough()).max(100),
  initiative_system: z.object({
    when_to_set: z.string(), has_turns: z.boolean(),
    roll_formula: nodeSchema.nullable().optional(), initiative_modifier: nodeSchema,
    initiative_tie_breakers: z.array(nodeSchema).max(20),
    initiative_degrade_per_pass: z.number().finite().nullable().optional(),
    min_initiative_to_act: z.number().finite().nullable().optional()
  }).passthrough(),
  difficulty_levels: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()).max(100).nullable().optional(),
  encounter_resolution_message: nodeSchema.nullable().optional(),
  is_encounter_within_difficulty_level: nodeSchema.nullable().optional()
}).passthrough();
export const resourceSchema = z.object({
  id: z.string().min(1), name: z.string(), display_name: z.string().nullable().optional(),
  stats: z.array(statSchema).max(2000),
  mechanics: z.array(z.unknown()).nullable().optional(),
  display_view: viewSchema.nullable().optional(), edit_view: viewSchema.nullable().optional(),
  list_view: viewSchema.nullable().optional(), search_item_view: viewSchema.nullable().optional()
}).passthrough();
export const systemSchema = z.object({
  id: z.string().min(1).max(200), name: z.string().min(1).max(500),
  abbreviation: z.string().min(1).max(100), version: z.string().min(1).max(100),
  min_app_version: z.string().nullable().optional(),
  character_display_name: z.string().nullable().optional(),
  character_stats: z.array(statSchema).min(1).max(2000),
  character_sheet_sections: z.array(z.object({ id: z.string(), view: viewSchema }).passthrough()).max(200),
  character_creation_flow: z.array(z.unknown()).max(200),
  character_indexed_stats: z.array(z.string()),
  character_search_item_view: viewSchema,
  progression_systems: z.record(z.string(), z.unknown()),
  mechanics: z.array(z.unknown()).max(5000),
  resources: z.array(resourceSchema).max(1000),
  enumerated_types: z.array(z.unknown()),
  combat_system: combatSchema.nullable().optional(),
  dice: z.array(z.object({
    id: z.string().min(1), name: z.string(),
    faces: z.number().int().min(2).max(1000000)
  }).passthrough()).max(100).optional()
}).passthrough();
export type Stat = z.infer<typeof statSchema>;
export type CombatDefinition = z.infer<typeof combatSchema>;
export type ResourceDefinition = z.infer<typeof resourceSchema>;
export type SystemDefinition = z.infer<typeof systemSchema>;
export type Diagnostic = { path: string; message: string; severity: 'warning' | 'error' };
/** Immutable import, keyed by source ID, source version, and exact-byte SHA-256. */
export interface StoredSystem {
  key: string;
  definition: SystemDefinition;
  /** Exact JSON text, decoded when necessary; `artifact` retains any gzip upload. */
  original: string;
  /** Exact gzip file, not a recompression of `original`; absent for JSON imports. */
  artifact?: { format: 'gzip-json'; base64: string };
  source: string;
  importedAt: string;
  digest: string;
  diagnostics: Diagnostic[];
}
/** Mutable character pinned to one immutable system import. */
export interface Character {
  id: string;
  systemKey: string;
  name: string;
  values: Record<string, Json>;
  resourceIds: string[];
  createdAt: string;
  updatedAt: string;
  revision: number;
}
/** Local instance; resourceIds links do not trigger rule-engine effects. */
export interface ResourceInstance {
  id: string;
  systemKey: string;
  definitionId: string;
  name: string;
  values: Record<string, Json>;
  createdAt?: string;
}
/** Internal, version-pinned encounter. Initialization overrides are not base values. */
export interface Combat {
  id: string; systemKey: string; name: string; difficulty: string | null;
  status: 'preparing' | 'active' | 'finished';
  round: number; pass: number; turn: number; revision: number;
  combatants: Combatant[];
  createdAt: string; updatedAt: string;
}
export interface Combatant {
  id: string; typeId: string;
  characterId?: string; resourceId?: string; templateId?: string;
  values: Record<string, Json>; overrides: Record<string, Json>;
  initiative: number | null; tieBreakers: (number | null)[];
  createdAt: string;
}
export interface Roll {
  id: string; systemKey: string; characterId?: string;
  formula: string; results: number[]; total: number; createdAt: string;
}
export interface Preferences {
  id: 'app'; theme: 'light' | 'dark'; historyLimit: number;
}
/** Narrow an untrusted non-array object or throw a path-qualified error. */
export function object(value: unknown, path = '$'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: oggetto richiesto`);
  return value as Record<string, unknown>;
}
/** Validate the common formula envelope; handlers validate their own operands. */
export function formula(value: unknown): Node {
  return nodeSchema.parse(value);
}
/** Validate the common view envelope without discarding extension fields. */
export function view(value: unknown): View {
  return viewSchema.parse(value);
}
/** Clone already bounded JSON data; missing defaults become explicit null. */
export function jsonValue(value: unknown): Json {
  // All persisted values originate from bounded JSON, inputs, or this engine.
  return value === undefined ? null : JSON.parse(JSON.stringify(value)) as Json;
}
/** Check supported scalar/list values; null is preserved as a nullable source value. */
export function matchesType(value: unknown, type: string, subtype?: string | null): boolean {
  if (value === null) return true;
  if (type === 'integer') return typeof value === 'number' && Number.isSafeInteger(value);
  if (type === 'decimal') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'string' || type === 'bool') return typeof value === (type === 'bool' ? 'boolean' : 'string');
  if (type === 'array') return Array.isArray(value) && (!subtype || value.every(v => matchesType(v, subtype)));
  if (type === 'resource') return isResourceReference(value);
  if (type === 'photo') return isPhoto(value);
  return false;
}
/** PolySheet-owned resource link, deliberately not an upstream instance export. */
export function isResourceReference(value: unknown): value is { resourceId: string } {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 1 && typeof object(value).resourceId === 'string'
    && String(object(value).resourceId).length > 0 && String(object(value).resourceId).length <= 500;
}
