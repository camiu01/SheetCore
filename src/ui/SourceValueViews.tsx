/**
 * @file Source value controls: ticker, button, select and menu button.
 * @remarks Inputs are staged through the enclosing session or patched directly.
 * Event dispatch is not implemented, so a source event stays explicitly visible.
 */
import { useState } from 'react';
import { createEvaluator } from '../engine/formulas';
import { enumerationEntries, type EnumerationEntry } from '../engine/enumerations';
import type { View } from '../domain/model';
import { boundedNumber, inputValue, resourceReferenceId, saveInput, sourceIcons, textValue, viewColor } from './view-support';
import { it } from './it';
import type { RenderContext } from './renderer';

/** Read a finite number from an evaluated formula or fail visibly. */
function numberValue(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}: numero richiesto`);
	return value;
}

/** Read a bounded list of finite numbers. */
function numberList(value: unknown): number[] {
	if (!Array.isArray(value) || !value.every(v => typeof v === 'number' && Number.isFinite(v)))
		throw new Error('allowed_values deve restituire una lista di numeri');
	return value;
}

/** Read an optional list of string ids used by `allowed_options`. */
function idList(value: unknown): string[] {
	if (!Array.isArray(value) || !value.every(v => typeof v === 'string'))
		throw new Error('allowed_options deve restituire una lista di testi');
	return value;
}

/** Next allowed value for one step, or undefined when the source list is exhausted. */
function steppedValue(value: number, direction: 1 | -1, amount: number, allowed?: number[]) {
	if (!allowed?.length) return value + direction * amount;
	const ordered = [...allowed].sort((a, b) => a - b);
	return direction > 0 ? ordered.find(item => item > value) : [...ordered].reverse().find(item => item < value);
}

/** Inline numeric editor; the parent owns bounds, errors and persistence. */
function TickerEditor({ label, value, integer, minimum, maximum, onCommit, onCancel }: {
	label: string; value: number | undefined; integer: boolean; minimum?: number; maximum?: number;
	onCommit: (text: string) => boolean; onCancel: () => void;
}) {
	return <input className="source-ticker-input" type="number" autoFocus aria-label={label}
		defaultValue={typeof value === 'number' ? value : ''} step={integer ? 1 : 'any'} min={minimum} max={maximum}
		onBlur={event => onCommit(event.target.value)}
		onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') onCancel(); }} />;
}

/** Source `ticker`: numeric counter with bounded stepping and direct editing. */
export function SourceTicker({ node: v, context: ctx, evaluate }: {
	node: View; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
	const stat = ctx.stats.find(s => s.id === v.stat);
	if (!stat) throw new Error(`Statistica mancante: ${String(v.stat)}`);
	if (!['integer', 'decimal'].includes(stat.value_type)) throw new Error('Il contatore richiede una statistica numerica');
	const editable = stat.type === 'base' && ctx.onChange !== undefined;
	const raw = editable ? inputValue(v, ctx, stat) : createEvaluator(ctx.stats, ctx.values, undefined, ctx).get(stat.id);
	const value = boundedNumber(raw);
	const minimum = boundedNumber(v.min_value_allowed)
		?? (v.calculated_min_value_allowed != null ? numberValue(evaluate(v.calculated_min_value_allowed), it.tickerMin) : undefined);
	const maximum = boundedNumber(v.max_value_allowed)
		?? (v.calculated_max_value_allowed != null ? numberValue(evaluate(v.calculated_max_value_allowed), it.tickerMax) : undefined);
	const allowed = v.allowed_values == null ? undefined : numberList(evaluate(v.allowed_values));
	const amount = boundedNumber(v.change_amount) ?? 1;
	const label = v.label == null ? '' : textValue(evaluate(v.label));
	const shown = typeof value === 'number' ? `${v.always_show_sign === true && value >= 0 ? '+' : ''}${value}` : '—';
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState('');

	function commit(next: number) {
		if ((minimum !== undefined && next < minimum) || (maximum !== undefined && next > maximum)
			|| (stat!.value_type === 'integer' && !Number.isSafeInteger(next))) { setError(it.invalidNumber); return false; }
		setError('');
		if (next !== value) saveInput(v, ctx, stat!.id, next);
		return true;
	}
	function commitText(text: string) {
		const next = Number(text);
		if (!text.trim() || !Number.isFinite(next)) { setError(it.invalidNumber); return false; }
		return commit(next);
	}
	function step(direction: 1 | -1) {
		if (!editable || typeof value !== 'number') return;
		let next = steppedValue(value, direction, amount, allowed);
		if (next === undefined) return;
		if (minimum !== undefined && next < minimum) next = minimum;
		if (maximum !== undefined && next > maximum) next = maximum;
		if (stat!.value_type === 'integer') next = Math.round(next);
		commit(next);
	}
	const look = v.button_look === 'upDown' ? 'upDown' : 'plusMinus';
	const location = typeof v.button_location === 'string' ? v.button_location : null;
	const decrement = <button type="button" className="ticker-button" disabled={!editable}
		aria-label={`${it.tickerDecrease} ${stat.name}`} onClick={() => step(-1)}>{look === 'upDown' ? '▾' : '−'}</button>;
	const increment = <button type="button" className="ticker-button" disabled={!editable}
		aria-label={`${it.tickerIncrease} ${stat.name}`} onClick={() => step(1)}>{look === 'upDown' ? '▴' : '+'}</button>;
	const valueElement = editing
		? <TickerEditor label={v.edit_bottom_sheet_title != null ? textValue(evaluate(v.edit_bottom_sheet_title)) : `${it.tickerEdit} ${stat.name}`}
			value={value} integer={stat.value_type === 'integer'} minimum={minimum} maximum={maximum}
			onCommit={text => { const ok = commitText(text); if (ok) setEditing(false); return ok; }}
			onCancel={() => setEditing(false)} />
		: v.hide_value === true ? null
			: <button type="button" className="source-ticker-value" disabled={!editable}
				aria-label={`${it.edit} ${stat.name}`} onClick={() => editable && setEditing(true)}>{shown}</button>;
	const labelElement = label ? <span className="source-ticker-label">{label}</span> : null;
	const pair = <>{decrement}{increment}</>;
	const labelFirst = v.label_alignment === 'left';
	const headingLevel = ({ headline: 2, title: 3, section: 4, subhead: 5 } as Record<string, number>)[String(v.style)];
	return <div className={`source-ticker source-ticker-${typeof v.style === 'string' ? v.style : 'text'}`}>
		<div className="source-ticker-row" role={headingLevel ? 'heading' : undefined} aria-level={headingLevel}>
			{location === 'left' && pair}
			{location === 'sideToSide' && decrement}
			{labelFirst && labelElement}
			{valueElement}
			{!labelFirst && labelElement}
			{location === 'right' && pair}
			{location === 'sideToSide' && increment}
		</div>
		{error && <small role="alert" className="error-text">{error}</small>}
		{ctx.onChange && !ctx.drafts && v.should_auto_save !== true && <small className="unsupported-note">{it.explicitSave}</small>}
	</div>;
}

/** Source `button`: renders source text and enabled state; events stay disabled. */
export function SourceButton({ node: v, evaluate }: {
	node: View; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
	const text = v.text == null ? '' : textValue(evaluate(v.text));
	const enabled = v.enabled == null ? true : evaluate(v.enabled) === true;
	const hasEvent = v.event != null || v.event_names != null;
	return <div className="source-button">
		<button type="button" className="button secondary" disabled={!enabled || hasEvent}>{text}</button>
		{hasEvent && <small className="unsupported-note">{it.eventNotExecuted}</small>}
	</div>;
}

/** One selectable option resolved from an enumeration or a local resource. */
interface SelectOption { id: string; label: string; value: string }

/** Read the display label of one local resource instance. */
function resourceLabel(record: { name: string; values: Record<string, unknown>; createdAt?: string }, definition: { stats: RenderContext['stats']; display_name?: string | null }, display: unknown, ctx: RenderContext) {
	const id = typeof display === 'string' ? display : definition.display_name;
	if (!id) return record.name;
	const value = createEvaluator(definition.stats, record.values, undefined, {
		resources: ctx.resources, resourceDefinitions: ctx.resourceDefinitions, createdAt: record.createdAt,
		enumerations: ctx.enumerations
	}).get(id);
	return textValue(value) || record.name;
}

/** Resolve select options from `options` or `resource_options`. */
function selectOptions(v: View, ctx: RenderContext, evaluate: (value: unknown) => unknown): SelectOption[] {
	const allowed = v.allowed_options == null ? undefined : idList(evaluate(v.allowed_options));
	const definitions = ctx.resourceDefinitions ?? [];
	if (v.resource_options != null) {
		const refs = evaluate(v.resource_options);
		if (!Array.isArray(refs)) throw new Error('resource_options deve restituire una lista di risorse');
		return refs.flatMap(ref => {
			const id = resourceReferenceId(ref);
			const record = id ? ctx.resources?.find(r => r.id === id && (!ctx.systemKey || r.systemKey === ctx.systemKey)) : undefined;
			if (!id || !record) throw new Error(it.missingResource);
			const definition = definitions.find(d => d.id === record.definitionId);
			if (!definition) throw new Error(it.noResourceType);
			if (allowed && !allowed.includes(record.id)) return [];
			const saved = typeof v.resource_saved_stat === 'string'
				? textValue(createEvaluator(definition.stats, record.values, undefined, {
					resources: ctx.resources, resourceDefinitions: definitions, createdAt: record.createdAt,
					enumerations: ctx.enumerations
				}).get(v.resource_saved_stat))
				: record.id;
			return [{ id: record.id, label: resourceLabel(record, definition, v.options_display_stat, ctx), value: saved }];
		});
	}
	if (typeof v.options !== 'string') throw new Error(it.noEnumeration);
	const definition = definitions.find(d => d.id === v.options);
	if (definition) {
		return (ctx.resources ?? [])
			.filter(record => record.definitionId === definition.id && (!ctx.systemKey || record.systemKey === ctx.systemKey))
			.filter(record => !allowed || allowed.includes(record.id))
			.map(record => ({ id: record.id, label: resourceLabel(record, definition, v.options_display_stat, ctx), value: record.id }));
	}
	const entries: EnumerationEntry[] = enumerationEntries(ctx.enumerations ?? [], v.options, allowed);
	return entries.map(entry => ({ id: entry.id, label: entry.name, value: entry.id }));
}

/** Source `select`: single or multiple options from an enumeration or local resources. */
export function SourceSelect({ node: v, context: ctx, evaluate }: {
	node: View; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
	const [error, setError] = useState('');
	const targetId = typeof v.stat === 'string' ? v.stat
		: v.meta_stat != null ? textValue(evaluate(v.meta_stat)) : '';
	if (!targetId || targetId.includes('.')) throw new Error('Il selettore richiede un campo base diretto');
	const stat = ctx.stats.find(s => s.id === targetId);
	if (!stat) throw new Error(`Statistica mancante: ${targetId}`);
	const multi = v.multi_select === true;
	const options = selectOptions(v, ctx, evaluate);
	const raw = inputValue(v, ctx, stat);
	// Stored values may be resource ids from `resource_saved_stat`; map them back to option ids.
	const stored = (Array.isArray(raw) ? raw : [raw]).filter((item): item is string => typeof item === 'string');
	const selected = options.filter(option => stored.includes(option.value)).map(option => option.id);
	const maximum = v.max_selection_amount == null ? undefined : numberValue(evaluate(v.max_selection_amount), it.selectMaximum);
	const editable = ctx.onChange !== undefined;
	const explicitSaveNote = ctx.onChange && !ctx.drafts && v.should_auto_save !== true
		? <small className="unsupported-note">{it.explicitSave}</small> : null;
	function choose(ids: string[]) {
		if (maximum !== undefined && ids.length > maximum) { setError(it.selectMaximumReached); return; }
		setError('');
		const values = ids.map(id => options.find(option => option.id === id)?.value ?? id);
		saveInput(v, ctx, stat!.id, multi ? values : values[0] ?? null);
	}
	function toggle(option: SelectOption) {
		if (!multi) { choose([option.id]); return; }
		choose(selected.includes(option.id) ? selected.filter(id => id !== option.id) : [...selected, option.id]);
	}
	if (v.style === 'list') return <fieldset className="source-select-list" disabled={!editable}>
		<legend>{stat.name}</legend>
		{options.map(option => <label key={option.id} className="check-field">
			<input type={multi ? 'checkbox' : 'radio'} name={String(v.id)} checked={selected.includes(option.id)}
				onChange={() => toggle(option)} />{option.label}
		</label>)}
		{error && <small role="alert" className="error-text">{error}</small>}
		{explicitSaveNote}
	</fieldset>;
	return <label className="field source-select">
		<span>{stat.name}</span>
		{multi
			? <select multiple aria-label={stat.name} disabled={!editable} value={selected}
				onChange={event => choose([...event.target.selectedOptions].map(option => option.value))}>
				{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
			</select>
			: <select aria-label={stat.name} disabled={!editable} value={selected[0] ?? ''}
				onChange={event => choose(event.target.value ? [event.target.value] : [])}>
				<option value="">{it.choose}</option>
				{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
			</select>}
		{error && <small role="alert" className="error-text">{error}</small>}
		{explicitSaveNote}
	</label>;
}

/** Source `menuButton`: enumeration menu; selecting an entry cannot fire events yet. */
export function SourceMenuButton({ node: v, context: ctx, evaluate }: {
	node: View; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
	const [open, setOpen] = useState(false);
	const [fired, setFired] = useState('');
	const allowed = v.allowed_options == null ? undefined : idList(evaluate(v.allowed_options));
	const entries = enumerationEntries(ctx.enumerations ?? [], String(v.options), allowed);
	const Icon = sourceIcons[String(v.icon_name)];
	const size = v.icon_size === 'small' ? 18 : v.icon_size === 'large' ? 32 : 24;
	const color = viewColor(v.icon_color, evaluate);
	return <div className="source-menu">
		<button type="button" className="icon-button source-menu-trigger" aria-haspopup="menu" aria-expanded={open}
			aria-label={it.sourceMenu} onClick={() => setOpen(value => !value)}>
			{Icon ? <Icon aria-hidden="true" size={size} color={color} /> : <span aria-hidden="true">⋯</span>}
		</button>
		{open && <div role="menu" className="source-menu-list">
			{entries.map(entry => <button key={entry.id} type="button" role="menuitem" className="link-button"
				onClick={() => { setFired(entry.id); setOpen(false); }}>{entry.name}</button>)}
			{!entries.length && <small className="muted">{it.noOptions}</small>}
		</div>}
		{fired && <small className="unsupported-note">{it.eventNotExecuted} · {fired}</small>}
	</div>;
}
