/**
 * @file Source single-resource and resource-array views.
 * @remarks Instance creation and owner assignment happen in one owner transaction.
 */
import { useEffect, useRef, useState } from 'react';
import { createEvaluator } from '../engine/formulas';
import { initialValues } from '../persistence/db';
import { commitResourceView } from '../persistence/views';
import { jsonValue, type ResourceDefinition, type ResourceInstance, type View } from '../domain/model';
import { RenderView, type RenderContext } from './renderer';
import { SourceForm } from './SourceForm';
import { Modal } from './shared';
import { inputValue, resourceReferenceIds, textValue } from './view-support';
import { it } from './it';

/** Resolve one local instance by id and exact definition, or fail visibly. */
function instance(ctx: RenderContext, definition: ResourceDefinition, id: string): ResourceInstance {
	const record = ctx.resources?.find(r => r.id === id && r.definitionId === definition.id && (!ctx.systemKey || r.systemKey === ctx.systemKey));
	if (!record) throw new Error(it.missingResource);
	return record;
}

/** Render one resource through the view type declared by the source node. */
function ResourceBody({ node: v, definition, record, context, onError }: {
	node: View; definition: ResourceDefinition; record: ResourceInstance; context: RenderContext;
	onError?: (cause: unknown) => void;
}) {
	const viewType = String(v.view_type ?? 'display');
	const source = viewType === 'display' ? definition.display_view
		: viewType === 'list' ? definition.list_view
		: viewType === 'edit' ? definition.edit_view : undefined;
	if (!source) throw new Error(it.noSourceView);
	// Direct edits patch the stored instance; draft sessions keep their single atomic patch.
	const writable = viewType === 'edit' && context.drafts === undefined && context.onChange !== undefined;
	return <RenderView input={source} context={{
		systemKey: record.systemKey, stats: definition.stats, values: record.values,
		resources: context.resources, resourceDefinitions: context.resourceDefinitions,
		enumerations: context.enumerations, createdAt: record.createdAt,
		onChange: writable ? (statId, value) => {
			void commitResourceView(record.id, { [statId]: value }).catch(cause => onError?.(cause));
		} : undefined
	}} />;
}

/** Source `resource`: display one referenced instance with its declared view. */
export function SourceResourceView({ node: v, context: ctx }: { node: View; context: RenderContext }) {
	const [error, setError] = useState('');
	const definition = ctx.resourceDefinitions?.find(d => d.id === v.resource_id);
	if (!definition) throw new Error(it.noResourceType);
	if (typeof v.stat !== 'string') throw new Error('Percorso della risorsa richiesto');
	const value = referenceValue(ctx, v);
	const id = resourceReferenceIds(value)[0];
	if (!id || Array.isArray(value)) {
		if (v.create_if_empty === true) return <p className="unsupported-note">{it.createIfEmptyUnsupported}</p>;
		return <p className="muted">{it.noResourceValue}</p>;
	}
	return <>
		<ResourceBody node={v} definition={definition} record={instance(ctx, definition, id)} context={ctx}
			onError={cause => setError(cause instanceof Error ? cause.message : String(cause))} />
		{error && <p role="alert" className="error-text">{error}</p>}
	</>;
}

/** One array entry: a popup trigger or the inline source body, plus removal. */
function ArrayItem({ node: v, definition, record, context, editable, popUp, onSelect, onRemove, onError }: {
	node: View; definition: ResourceDefinition; record: ResourceInstance; context: RenderContext;
	editable: boolean; popUp: boolean; onSelect: (record: ResourceInstance) => void;
	onRemove: (record: ResourceInstance) => void; onError: (cause: unknown) => void;
}) {
	const removeButton = <button type="button" className="link-button" onClick={() => onRemove(record)}>{it.detach} · {record.name}</button>;
	return <article className="source-resource-item">
		{popUp ? <>
			<button type="button" className="link-button" onClick={() => onSelect(record)}>
				{v.pop_up_button_text != null ? textValue(evaluateItem(context, definition, record, v.pop_up_button_text)) : record.name}
			</button>
			{editable && removeButton}
		</> : <ResourceBody node={v} definition={definition} record={record} context={context} onError={onError} />}
		{!popUp && editable && removeButton}
	</article>;
}

/** Creation modal for one new instance; the owner transaction receives it. */
function ArrayCreateModal({ definition, context, onCreated, onBusyChange, onClose }: {
	definition: ResourceDefinition; context: RenderContext;
	onCreated: (record: ResourceInstance, additions: ResourceInstance[]) => void;
	onBusyChange: (busy: boolean) => void; onClose: () => void;
}) {
	if (!definition.edit_view) return null;
	return <Modal title={it.addResource} onClose={onClose}>
		<SourceForm input={definition.edit_view} onBusyChange={onBusyChange} onDone={onClose} context={{
			systemKey: context.systemKey, stats: definition.stats, values: initialValues(definition.stats),
			resources: context.resources, resourceDefinitions: context.resourceDefinitions, enumerations: context.enumerations,
			onCommit: async (patch, additions = []) => {
				if (!context.systemKey) throw new Error(it.formReadOnly);
				const values = initialValues(definition.stats);
				const changes = typeof patch === 'function' ? patch(values) : patch;
				const next = { ...values, ...Object.fromEntries(Object.entries(changes).map(([id, value]) => [id, jsonValue(value)])) };
				const name = definition.display_name
					? textValue(createEvaluator(definition.stats, next, undefined, context).get(definition.display_name)) || definition.name
					: definition.name;
				const record = { id: crypto.randomUUID(), systemKey: context.systemKey, definitionId: definition.id, name: name.slice(0, 100), values: next, createdAt: new Date().toISOString() };
				onCreated(record, [...additions, record]);
			}
		}} />
	</Modal>;
}

/** Source `resourceArray`: display, create, edit and remove an array of instances. */
export function SourceResourceArray({ node: v, context: ctx }: { node: View; context: RenderContext }) {
	const definition = ctx.resourceDefinitions?.find(d => d.id === v.resource_id);
	if (!definition) throw new Error(it.noResourceType);
	const field = ctx.stats.find(s => s.id === v.stat && s.type === 'base');
	const records = resourceReferenceIds(referenceValue(ctx, v)).map(id => instance(ctx, definition, id));
	const editable = v.view_type === 'edit' && !!field && !!ctx.onCommit && v.allow_adds_and_removes !== false;
	const popUp = typeof v.pop_up_type === 'string';
	const [selected, setSelected] = useState<ResourceInstance | null>(null);
	const [editing, setEditing] = useState(false);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const autoAdded = useRef(false);
	const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));

	function append(record: ResourceInstance, created: ResourceInstance[]) {
		if (!ctx.onCommit || !field) throw new Error(it.formReadOnly);
		void ctx.onCommit(latest => {
			const items = latest[field.id];
			const current = Array.isArray(items) ? items : [];
			if (current.length >= 10000) throw new Error(it.resourceListLimit);
			return { [field.id]: [...current, { resourceId: record.id }] };
		}, created).catch(fail);
	}
	function remove(record: ResourceInstance) {
		if (!ctx.onCommit || !field) return;
		void ctx.onCommit(latest => {
			const items = latest[field.id];
			if (!Array.isArray(items)) throw new Error(it.invalidValue);
			return { [field.id]: items.filter(item => resourceReferenceIds(item)[0] !== record.id) };
		}).catch(fail);
	}
	// Empty required arrays get one empty instance, as declared by auto_add_first.
	useEffect(() => {
		if (autoAdded.current || !editable || v.auto_add_first !== true || records.length || !definition.edit_view) return;
		autoAdded.current = true;
		const values = initialValues(definition.stats);
		const name = definition.display_name
			? textValue(createEvaluator(definition.stats, values, undefined, ctx).get(definition.display_name)) || definition.name
			: definition.name;
		append({ id: crypto.randomUUID(), systemKey: ctx.systemKey ?? '', definitionId: definition.id, name, values, createdAt: new Date().toISOString() }, []);
	}, [editable, records.length, v.auto_add_first, definition, ctx]);
	const create = editable && definition.edit_view
		? <button type="button" className="button secondary" onClick={() => { setCreating(true); setError(''); }}>{it.addResource}</button>
		: null;
	return <div className={`source-resource-array ${v.hide_line === true ? 'no-line' : ''}`}>
		<div className="source-array-header">{v.left_view != null && <RenderView input={v.left_view} context={ctx} />}{create}</div>
		{!records.length && <p className="muted">{it.noResourceValue}</p>}
		{records.map(record => <ArrayItem key={record.id} node={v} definition={definition} record={record} context={ctx}
			editable={editable} popUp={popUp} onRemove={remove} onError={fail}
			onSelect={next => { setSelected(next); setEditing(false); }} />)}
		{error && <p role="alert" className="error-text">{error}</p>}
		{!editable && v.view_type === 'edit' && <p className="unsupported-note">{it.resourceListReadOnly}</p>}
		{!popUp && v.view_type === 'edit' && ctx.drafts !== undefined && <p className="unsupported-note">{it.resourceEditOutsideForm}</p>}
		{selected && <Modal title={selected.name} bottomSheet={v.pop_up_type === 'bottomSheet'} onClose={() => { if (!busy) { setSelected(null); setEditing(false); } }}>
			{editing && definition.edit_view ? <SourceForm input={definition.edit_view} context={{
				systemKey: selected.systemKey, stats: definition.stats, values: selected.values,
				resources: ctx.resources, resourceDefinitions: ctx.resourceDefinitions, enumerations: ctx.enumerations,
				onCommit: (patch, additions) => commitResourceView(selected.id, patch, additions)
			}} onBusyChange={setBusy} onDone={() => { setSelected(null); setEditing(false); }} />
				: <><ResourceBody node={{ ...v, view_type: 'display' }} definition={definition} record={selected} context={ctx} />
					{definition.edit_view && <button type="button" className="button secondary" onClick={() => setEditing(true)}>{it.edit}</button>}</>}
		</Modal>}
		{creating && <ArrayCreateModal definition={definition} context={ctx} onBusyChange={setBusy}
			onClose={() => !busy && setCreating(false)}
			onCreated={(record, additions) => { append(record, additions); setCreating(false); }} />}
	</div>;
}

/** Evaluate one per-instance formula with that resource as the visible scope. */
function evaluateItem(ctx: RenderContext, definition: ResourceDefinition, record: ResourceInstance, value: unknown) {
	return createEvaluator(definition.stats, record.values, undefined, {
		resources: ctx.resources, resourceDefinitions: ctx.resourceDefinitions, createdAt: record.createdAt,
		enumerations: ctx.enumerations
	}).evaluate(value);
}

/** Read a view's referenced value from drafts, overrides or persisted values. */
function referenceValue(ctx: RenderContext, v: View): unknown {
	const field = ctx.stats.find(s => s.id === v.stat);
	if (!field) throw new Error(`Statistica mancante: ${String(v.stat)}`);
	return inputValue(v, ctx, field);
}
