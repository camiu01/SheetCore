/**
 * @file Bounded resolution of source enumerated types, including inherited entries.
 * @remarks Enumerations only supply option labels and ids. They never change rule values.
 */
import { object } from '../domain/model';

/** One selectable source enumeration entry, already validated. */
export interface EnumerationEntry {
	id: string;
	name: string;
	abbreviation?: string;
}

/** Maximum inheritance hops accepted for one enumerated type. */
const MAX_INHERITANCE = 16;

/**
 * Resolve one enumerated type and its inherited entries in declaration order.
 * @param types - Raw `enumerated_types` array from the imported system.
 * @param typeId - Enumerated type id referenced by the view.
 * @param allowed - Optional allowlist of entry ids.
 * @returns Entries in declaration order; inherited entries keep their position.
 * @throws When the type is missing, malformed, or inherits too deeply.
 */
export function enumerationEntries(types: unknown[], typeId: string, allowed?: string[]): EnumerationEntry[] {
	if (!Array.isArray(types)) throw new Error('Enumerazioni del sistema non disponibili');
	const byId = new Map<string, Record<string, unknown>>();
	for (const raw of types) {
		const entry = object(raw);
		if (typeof entry.id === 'string') byId.set(entry.id, entry);
	}
	const entries = new Map<string, EnumerationEntry>();
	const visited = new Set<string>();
	function visit(id: string, depth: number) {
		if (depth > MAX_INHERITANCE) throw new Error('Gerarchia di enumerazioni troppo profonda');
		if (visited.has(id)) return;
		visited.add(id);
		const type = byId.get(id);
		if (!type) throw new Error(`Enumerazione mancante: ${id}`);
		const parent = type.extends_type;
		if (typeof parent === 'string' && parent) visit(parent, depth + 1);
		if (!Array.isArray(type.types)) throw new Error(`Enumerazione non valida: ${id}`);
		for (const raw of type.types) {
			const value = object(raw);
			if (typeof value.id !== 'string' || !value.id) throw new Error(`Voce di enumerazione non valida: ${id}`);
			entries.set(value.id, {
				id: value.id,
				name: typeof value.name === 'string' ? value.name : value.id,
				...(typeof value.abbreviation === 'string' ? { abbreviation: value.abbreviation } : {})
			});
		}
	}
	visit(typeId, 0);
	const all = [...entries.values()];
	if (!allowed) return all;
	const wanted = new Set(allowed);
	return all.filter(entry => wanted.has(entry.id));
}
