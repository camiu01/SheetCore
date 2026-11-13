/** @file Source popup and local resource controls; general events stay unsupported. */
import { useState } from 'react';
import { createEvaluator } from '../engine/formulas';
import { isResourceReference, jsonValue, object, type ResourceInstance, type View } from '../domain/model';
import { initialValues } from '../persistence/db';
import { commitResourceView } from '../persistence/views';
import { RenderView, textValue, type RenderContext } from './renderer';
import { SourceForm } from './SourceForm';
import { Modal } from './shared';
import { it } from './it';

/** Outside an edit session, selection waits for an explicit form Save. */
export function DeferredResourceSelect({ node, context }: { node: View; context: RenderContext }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return <><button type="button" className="button secondary" onClick={() => setOpen(true)}>{it.edit} · {node.id}</button>
    {open && <Modal title={it.edit} onClose={() => !busy && setOpen(false)}>
      <SourceForm input={node} context={context} onBusyChange={setBusy} onDone={() => setOpen(false)} />
    </Modal>}</>;
}

/** A popup owns its draft scope; persistence errors never close a dirty form. */
export function SourcePopup({ node: v, context: ctx }: { node: View; context: RenderContext }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  try {
  if (v.icon != null && object(v.icon).type !== 'icon') throw new Error(`${it.unsupported}: popUpButton.icon`);
  const e = createEvaluator(ctx.stats, ctx.values, undefined, ctx).evaluate;
  const title = v.pop_up_title ? textValue(e(v.pop_up_title)) : it.details;
  const save = v.display_save_button === true || v.save_text != null;
  return <><button type="button" className="button secondary" aria-label={v.text ? textValue(e(v.text)) : title} onClick={() => setOpen(true)}>
    {v.icon ? <RenderView input={v.icon} context={ctx} /> : v.text ? textValue(e(v.text)) : title}
  </button>{open && <Modal title={title} bottomSheet={v.pop_up_type == null || v.pop_up_type === 'bottomSheet'} onClose={() => !busy && setOpen(false)}>
    <SourceForm input={v.pop_up_view} context={{
      ...ctx,
      values: ctx.previewValues ?? ctx.values,
      onCommit: v.should_persist_on_save === true || ctx.drafts ? ctx.onCommit : undefined
    }} onBusyChange={setBusy} onDone={() => setOpen(false)} showSave={save} showCancel={v.display_cancel_button !== false}
      saveText={v.save_text ? textValue(e(v.save_text)) : it.save}
      cancelText={v.cancel_text ? textValue(e(v.cancel_text)) : it.cancel} />
    {save && v.should_persist_on_save !== true && !ctx.drafts && <p className="unsupported-note">{it.formReadOnly}</p>}
    {v.extra_buttons != null && <p className="unsupported-note">{it.unsupported}: extra_buttons</p>}
  </Modal>}</>;
  } catch (error) { return <p data-view-error className="unsupported">{error instanceof Error ? error.message : String(error)}</p>; }
}

/** Create via the original edit view, then assign only the correct pinned type. */
export function SourceResourceSelect({ node: v, context: ctx }: { node: View; context: RenderContext }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const definition = ctx.resourceDefinitions?.find(d => d.id === v.resource_id);
  const field = ctx.stats.find(s => s.id === v.stat && s.type === 'base' && (s.value_type === 'resource' || s.value_type === 'array' && s.sub_value_type === 'resource'));
  if (!definition || !field) return <p data-view-error className="unsupported">{it.noResourceType}</p>;
  const fieldId = field.id, arrayField = field.value_type === 'array';
  const inline = v.create_in_place === true || definition.core !== true || v.inline_creation_mode === 'only';
  const resources = (ctx.resources ?? []).filter(r => r.definitionId === definition.id && (!ctx.systemKey || r.systemKey === ctx.systemKey));
  const selected = ctx.drafts && Object.hasOwn(ctx.drafts, v.id) ? ctx.drafts[v.id] : ctx.values[fieldId] ?? field.default_value;
  const selectedRefs = Array.isArray(selected) ? selected : [selected];
  const selectedNames = selectedRefs.filter(isResourceReference).map(ref => resources.find(r => r.id === ref.resourceId)?.name ?? it.missingResource).join(', ');
  async function assign(record: ResourceInstance, created: ResourceInstance[]) {
    if (!ctx.onCommit) throw new Error(it.formReadOnly);
    if (ctx.systemKey && record.systemKey !== ctx.systemKey) throw new Error(it.invalidValue);
    await ctx.onCommit(latest => {
      const current = latest[fieldId];
      const previous = v.should_append === true && Array.isArray(current) ? current : [];
      if (previous.length >= 10000) throw new Error(it.resourceListLimit);
      return { [fieldId]: arrayField ? [...previous, { resourceId: record.id }] : { resourceId: record.id } };
    }, created);
    setOpen(false); setCreating(false);
  }
  return <><button type="button" className="button secondary" aria-label={`${it.addResource} · ${definition.name}`} disabled={!ctx.onCommit}
    onClick={() => { setError(''); setNewId(crypto.randomUUID()); setCreating(inline); setOpen(true); }}>
    {v.view_type === 'icon' ? '+' : selectedNames || `${it.choose} ${definition.name}`}
  </button>{open && <Modal title={`${it.addResource} · ${definition.name}`} bottomSheet={v.creation_pop_up_type == null || v.creation_pop_up_type === 'bottomSheet'} onClose={() => !busy && setOpen(false)}>
    {v.filters != null ? <p data-view-error className="unsupported">{it.unsupported}: filters</p> : creating ? definition.edit_view ? <SourceForm
      input={definition.edit_view} onBusyChange={setBusy} onDone={() => setOpen(false)} context={{
        systemKey: ctx.systemKey, stats: definition.stats, values: initialValues(definition.stats),
        resources: ctx.resources, resourceDefinitions: ctx.resourceDefinitions, enumerations: ctx.enumerations,
        onCommit: async (patch, additions = []) => {
          if (!ctx.systemKey) throw new Error(it.formReadOnly);
          const values = initialValues(definition.stats);
          const changes = typeof patch === 'function' ? patch(values) : patch;
          const next = { ...values, ...Object.fromEntries(Object.entries(changes).map(([id, value]) => [id, jsonValue(value)])) };
          const name = definition.display_name ? textValue(createEvaluator(definition.stats, next, undefined, ctx).get(definition.display_name)) : definition.name;
          const record = { id: newId, systemKey: ctx.systemKey, definitionId: definition.id, name: name.slice(0, 100) || definition.name, values: next, createdAt: new Date().toISOString() };
          await assign(record, [...additions, record]);
        }
      }} /> : <p className="unsupported" data-view-error>{it.noEditView}</p> : <>
      <p className="muted">{it.localResourceSelection}</p>
      {resources.map(r => <button type="button" key={r.id} className="button secondary" disabled={busy} onClick={() => {
        setBusy(true); setError('');
        const record = v.preserve_ids === true ? r : { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        void assign(record, v.preserve_ids === true ? [] : [record]).catch(e => setError(String(e))).finally(() => setBusy(false));
      }}>{r.name}</button>)}
      {!resources.length && <p>{it.noResources}</p>}
      {v.inline_creation_mode === 'optional' && <button type="button" className="button secondary" onClick={() => setCreating(true)}>{it.newResource}</button>}
    </>}
    {error && <p role="alert">{error}</p>}
  </Modal>}</>;
}

/** Render local list/display/edit views; unlinking never destroys an instance. */
export function SourceResourceSection({ node: v, context: ctx }: { node: View; context: RenderContext }) {
  const [selected, setSelected] = useState<ResourceInstance | null>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  try {
    const definition = ctx.resourceDefinitions?.find(d => d.id === v.resource_id);
    if (!definition) throw new Error(it.noResourceType);
    const evaluated = createEvaluator(ctx.stats, ctx.previewValues ?? ctx.values, undefined, ctx).get(String(v.resource_stat));
    const refs = ctx.drafts && (v.resource_set_stat == null || v.resource_set_stat === v.resource_stat) && Object.hasOwn(ctx.drafts, v.id) ? ctx.drafts[v.id] : evaluated;
    if (!Array.isArray(refs) || !refs.every(isResourceReference)) throw new Error(it.invalidValue);
    const records = refs.map(ref => {
      const r = ctx.resources?.find(r => r.id === ref.resourceId && r.definitionId === definition.id && (!ctx.systemKey || r.systemKey === ctx.systemKey));
      if (!r) throw new Error(it.missingResource);
      return r;
    });
    const field = String(v.resource_set_stat ?? v.resource_stat);
    const editable = v.read_only !== true && !!ctx.onCommit && ctx.stats.some(s => s.id === field && s.type === 'base');
    const resourceContext = (r: ResourceInstance): RenderContext => ({
      systemKey: r.systemKey, stats: definition.stats, values: r.values, resources: ctx.resources,
      resourceDefinitions: ctx.resourceDefinitions, createdAt: r.createdAt
    });
    const visible = !expanded && typeof v.max_items_in_preview === 'number' ? records.slice(0, Math.max(0, v.max_items_in_preview)) : records;
    function move(fromId: string, toId: string) {
      if (!editable || v.reorganizable !== true || fromId === toId) return;
      void ctx.onCommit?.(latest => {
        const items = latest[field];
        if (!Array.isArray(items) || !items.every(isResourceReference)) throw new Error(it.invalidValue);
        const from = items.findIndex(r => r.resourceId === fromId), to = items.findIndex(r => r.resourceId === toId);
        if (from < 0 || to < 0) throw new Error(it.resourceListReadOnly);
        const next = items.slice();
        next.splice(to, 0, ...next.splice(from, 1));
        return { [field]: next };
      }).catch(e => setError(String(e)));
    }
    const width = typeof v.content_item_min_width === 'number' && Number.isFinite(v.content_item_min_width) ? Math.max(1, Math.min(800, v.content_item_min_width)) : 160;
    const minimum = typeof v.content_item_min_width === 'number' && v.content_item_min_width > 0 && v.content_item_min_width <= 1 ? `${v.content_item_min_width * 100}%` : `${width}px`;
    return <div className="source-resource-section" style={{
      gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${minimum}),1fr))`,
      justifyItems: v.alignment === 'start' ? 'start' : v.alignment === 'end' ? 'end' : 'center'
    }}>
      {v.header_view != null && <RenderView input={v.header_view} context={ctx} />}
      {visible.map((r, index) => <article className="source-resource-item" key={`${r.id}:${index}`}
        draggable={editable && v.reorganizable === true} onDragStart={e => e.dataTransfer.setData('text/plain', r.id)}
        onDragOver={e => { if (editable && v.reorganizable === true) e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); move(e.dataTransfer.getData('text/plain'), r.id); }}>
        {definition.list_view ? <RenderView input={definition.list_view} context={resourceContext(r)} /> : <strong>{r.name}</strong>}
        <div className="button-row">
          {v.tap_displays_resource !== false && <button type="button" className="link-button" onClick={() => { setSelected(r); setEditing(false); }}>{it.details} · {r.name}</button>}
          {editable && <button type="button" className="link-button" onClick={() => {
            void ctx.onCommit?.(latest => {
              const items = latest[field];
              if (!Array.isArray(items)) throw new Error(it.invalidValue);
              return { [field]: items.filter(item => !isResourceReference(item) || item.resourceId !== r.id) };
            }).catch(e => setError(String(e)));
          }}>{it.detach} · {r.name}</button>}
          {editable && v.reorganizable === true && <>
            <button type="button" className="link-button" disabled={index === 0} onClick={() => move(r.id, visible[index - 1].id)}>{it.moveUp} · {r.name}</button>
            <button type="button" className="link-button" disabled={index === visible.length - 1} onClick={() => move(r.id, visible[index + 1].id)}>{it.moveDown} · {r.name}</button>
          </>}
        </div>
      </article>)}
      {visible.length < records.length && <button type="button" className="button secondary" onClick={() => setExpanded(true)}>{it.showAll}</button>}
      {error && <p role="alert">{error}</p>}
      {!editable && v.read_only !== true && ctx.onCommit && <p className="unsupported-note">{it.resourceListReadOnly}</p>}
      {selected && <Modal title={selected.name} onClose={() => { if (!busy) { setSelected(null); setEditing(false); } }}>
        {editing && definition.edit_view ? <SourceForm input={definition.edit_view} context={{
          ...resourceContext(selected), onCommit: (patch, additions) => commitResourceView(selected.id, patch, additions)
        }} onBusyChange={setBusy} onDone={() => { setSelected(null); setEditing(false); }} /> : <>
          {definition.display_view ? <RenderView input={definition.display_view} context={resourceContext(selected)} /> : <p>{it.noResourceView}</p>}
          {editable && !ctx.drafts && definition.edit_view && <button type="button" className="button secondary" onClick={() => setEditing(true)}>{it.edit}</button>}
          {editable && ctx.drafts && <p className="unsupported-note">{it.resourceEditOutsideForm}</p>}
        </>}
      </Modal>}
    </div>;
  } catch (error) { return <p data-view-error className="unsupported">{error instanceof Error ? error.message : String(error)}</p>; }
}
