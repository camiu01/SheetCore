/** @file Typed internal resource references, shared by writes and backup validation. */
import { isResourceReference, type Stat, type ResourceInstance } from './model';

/** Return links only from fields explicitly declared as resource-valued. */
export function referencedIds(stat: Stat, value: unknown): string[] {
  if (stat.value_type === 'resource') return isResourceReference(value) ? [value.resourceId] : [];
  if (stat.value_type === 'array' && stat.sub_value_type === 'resource' && Array.isArray(value))
    return value.filter(isResourceReference).map(v => v.resourceId);
  return [];
}
/** Reject missing, cross-version, or explicitly wrong resource types. */
export function checkReferences(stats: Stat[], values: Record<string, unknown>, resources: ResourceInstance[], systemKey: string) {
  for (const stat of stats) for (const id of referencedIds(stat, values[stat.id])) {
    const record = resources.find(r => r.id === id);
    if (!record || record.systemKey !== systemKey || (stat.resource_type && record.definitionId !== stat.resource_type))
      throw new Error(`${stat.id}: risorsa mancante, di tipo errato o appartenente a un’altra versione (${id}).`);
  }
}
