/**
 * @file Shared, React-free helpers for source view rendering.
 * @remarks Colours and identifiers accept only documented palette names, bounded
 * hex literals and validated resource links.
 */
import { BookOpen, Shield, Backpack, Swords, Flag, Dices, Skull, Sparkles, Star, Pencil, MoreHorizontal, MoreVertical, Sun, PawPrint, ArrowUp, ArrowUpDown, Flame, Badge, Circle } from 'lucide-react';
import { isResourceReference, type Stat, type View } from '../domain/model';
import { it } from './it';

/** Minimal rendering state needed to read and stage one source input. */
export interface InputContext {
	values: Record<string, unknown>;
	drafts?: Record<string, unknown>;
	overrides?: Record<string, unknown>;
	onChange?: (id: string, value: unknown) => void;
	onInput?: (viewId: string, statId: string, value: unknown) => void;
}


/** Explicit source icon names mapped to local glyphs; artwork is not copied. */
export const sourceIcons: Record<string, typeof Shield> = {
	ic_armor: Shield, ic_backpack: Backpack, ic_battle: Swords, ic_campaign_banner: Flag, ic_d20: Dices,
	ic_death: Skull, ic_skills: Sparkles, ic_star: Star, ic_weapon: Swords, ic_badge: Badge,
	ic_conditions: Circle, ic_daytime: Sun, ic_edit: Pencil, ic_more_horiz: MoreHorizontal,
	ic_more_vert: MoreVertical, ic_notes: BookOpen, ic_pets: PawPrint, ic_progression: ArrowUp,
	ic_sort: ArrowUpDown, ic_stars: Sparkles, ic_whatshot: Flame
};

/** Render a scalar source value as text; complex values are never coerced. */
export function textValue(value: unknown) {
	if (value === null || value === undefined) return '';
	if (typeof value === 'object') throw new Error('Valore complesso non visualizzabile come testo');
	return String(value);
}

/** CSS accepts only documented colours or bounded hexadecimal literals. */
export function sourceColor(value: unknown): string | undefined {
	if (value == null) return undefined;
	const colors: Record<string, string> = {
		accent: 'var(--accent)', primary: 'var(--accent)', primaryDark: 'var(--accent)',
		text: 'var(--ink)', hint: 'var(--muted)', buttonSurface: 'var(--surface-soft)'
	};
	if (typeof value === 'string' && Object.hasOwn(colors, value)) return colors[value];
	if (typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)) return value;
	throw new Error(it.invalidColor);
}

/** View colours are either literal palette values or formulas returning one. */
export function viewColor(value: unknown, evaluate: (input: unknown) => unknown): string | undefined {
	if (value == null) return undefined;
	return sourceColor(typeof value === 'string' ? value : evaluate(value));
}

/**
 * Read a resource instance id from a reference object or a stored string id.
 * @returns The id, or undefined when the value is not a resource reference.
 */export function resourceReferenceId(value: unknown): string | undefined {
	if (isResourceReference(value)) return value.resourceId;
	if (typeof value === 'string' && value.length > 0 && value.length <= 500) return value;
	if (Array.isArray(value) && value.length === 1) return resourceReferenceId(value[0]);
	return undefined;
}

/** Read every resource id from a scalar, reference or reference array value. */
export function resourceReferenceIds(value: unknown): string[] {
	const items = Array.isArray(value) ? value : [value];
	return items.map(resourceReferenceId).filter((id): id is string => id !== undefined);
}

/** Clamp a finite numeric option into a safe display range. */
export function boundedNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Current value for one input view, preferring session drafts over persisted values. */
export function inputValue(v: View, ctx: InputContext, s: Stat) {
	return ctx.drafts && Object.hasOwn(ctx.drafts, v.id) ? ctx.drafts[v.id]
		: ctx.overrides && Object.hasOwn(ctx.overrides, s.id) ? ctx.overrides[s.id]
		: Object.hasOwn(ctx.values, s.id) ? ctx.values[s.id] : s.default_value;
}

/** Route one input change to the session draft or the persisted owner. */
export function saveInput(v: View, ctx: InputContext, id: string, value: unknown) {
	if (ctx.onInput) ctx.onInput(v.id, id, value); else ctx.onChange?.(id, value);
}

