/** @file Manual typed resource editing, including nested references and local photos. */
import { useState } from 'react';
import { jsonValue, type ResourceDefinition, type ResourceInstance, type StoredSystem } from '../domain/model';
import { db, initialValues } from '../persistence/db';
import { createEvaluator } from '../engine/formulas';
import { saveResource } from '../persistence/resources';
import { FieldInput } from './FieldInput';
import { it } from './it';
import type { Run } from './shared';
import { SourceForm } from './SourceForm';
import { commitResourceView } from '../persistence/views';

/** Stage fields locally and validate the complete resource before one atomic save. */
export function ResourceEditor({ system, definition, editing, resources, onSelect, onDone, run }: {
  system: StoredSystem; definition: ResourceDefinition; editing: ResourceInstance | 'new';
  resources: ResourceInstance[]; onSelect: (id: string) => void; onDone: () => void; run: Run;
}) {
  const [values, setValues] = useState(() => editing === 'new' ? initialValues(definition.stats) : editing.values);
  const [name, setName] = useState(editing === 'new' ? '' : editing.name);
  if (definition.edit_view) return <><label className="field"><span>{it.resourceType}</span><select value={definition.id} disabled={editing !== 'new'} onChange={e => onSelect(e.target.value)}>
    {system.definition.resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
  </select></label><SourceForm input={definition.edit_view} onDone={onDone} context={{
    systemKey: system.key, stats: definition.stats, values, resources, resourceDefinitions: system.definition.resources,
    createdAt: editing === 'new' ? undefined : editing.createdAt,
    onCommit: async (patch, additions = []) => {
      if (editing !== 'new') { await commitResourceView(editing.id, patch, additions); return; }
      const changes = typeof patch === 'function' ? patch(values) : patch;
      const next = { ...values, ...Object.fromEntries(Object.entries(changes).map(([id, value]) => [id, jsonValue(value)])) };
      await db.transaction('rw', db.resources, db.systems, async () => {
        for (const record of additions) await saveResource(record);
        const display = definition.display_name ? createEvaluator(definition.stats, next, undefined, { resources: [...resources, ...additions], resourceDefinitions: system.definition.resources }).get(definition.display_name) : definition.name;
        if (typeof display !== 'string') throw new Error(it.invalidValue);
        await saveResource({ id: crypto.randomUUID(), systemKey: system.key, definitionId: definition.id, name: display.slice(0, 100) || definition.name, values: next, createdAt: new Date().toISOString() });
      });
    }
  }} /></>;
  return <form onSubmit={e => {
    e.preventDefault();
    if (e.currentTarget.querySelector('[aria-invalid="true"]')) return;
    void run(async () => {
      await saveResource({
        id: editing === 'new' ? crypto.randomUUID() : editing.id, systemKey: system.key,
        definitionId: definition.id, name: name.trim(), values,
        ...(editing === 'new' ? { createdAt: new Date().toISOString() } : editing.createdAt ? { createdAt: editing.createdAt } : {})
      });
      onDone();
    });
  }}>
    <label className="field"><span>{it.resourceType}</span><select value={definition.id} disabled={editing !== 'new'} onChange={e => onSelect(e.target.value)}>
      {system.definition.resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select></label>
    <label className="field"><span>{it.resourceName}</span><input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
    <p className="muted">{it.manualHelp}</p>
    {definition.stats.filter(s => s.type === 'base').map(s => <FieldInput key={s.id} stat={s} value={values[s.id]} resources={resources}
      onSave={value => setValues(previous => ({ ...previous, [s.id]: jsonValue(value) }))} />)}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onDone}>{it.cancel}</button><button className="button primary">{it.saveResource}</button></div>
  </form>;
}
