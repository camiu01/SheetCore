/** @file Manual typed resource editing, including nested references and local photos. */
import { useState } from 'react';
import { jsonValue, type Json, type ResourceDefinition, type ResourceInstance, type StoredSystem } from '../domain/model';
import { db, initialValues } from '../persistence/db';
import { createEvaluator } from '../engine/formulas';
import { saveResource } from '../persistence/resources';
import { FieldInput } from './FieldInput';
import { it } from './it';
import type { Run } from './shared';
import { SourceForm } from './SourceForm';
import { commitResourceView } from '../persistence/views';

/** Stage source or explicit manual fields; manual mode validates data, not source rules. */
export function ResourceEditor({ system, definition, editing, resources, onSelect, onDone, onBusyChange, run }: {
  system: StoredSystem; definition: ResourceDefinition; editing: ResourceInstance | 'new';
  resources: ResourceInstance[]; onSelect: (id: string) => void; onDone: () => void; run: Run;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [values, setValues] = useState(() => editing === 'new' ? initialValues(definition.stats) : editing.values);
  const [name, setName] = useState(editing === 'new' ? '' : editing.name);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<Record<string, Json>>({});
  function saving(next: boolean) { setBusy(next); onBusyChange?.(next); }
  if (definition.edit_view && !manual) return <><label className="field"><span>{it.resourceType}</span><select value={definition.id} disabled={editing !== 'new' || busy} onChange={e => onSelect(e.target.value)}>
    {system.definition.resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
  </select></label>
  <p className="muted">{it.manualResourceHelp}</p>
  <button type="button" className="button secondary" disabled={busy} onClick={() => setManual(true)}>{it.manualResourceEditor}</button>
  <SourceForm input={definition.edit_view} onDone={onDone} onBusyChange={saving} context={{
    systemKey: system.key, stats: definition.stats, values, resources, resourceDefinitions: system.definition.resources,
    enumerations: system.definition.enumerated_types,
    createdAt: editing === 'new' ? undefined : editing.createdAt,
    onCommit: async (patch, additions = []) => {
      if (editing !== 'new') { await commitResourceView(editing.id, patch, additions); return; }
      const changes = typeof patch === 'function' ? patch(values) : patch;
      const next = { ...values, ...Object.fromEntries(Object.entries(changes).map(([id, value]) => [id, jsonValue(value)])) };
      await db.transaction('rw', db.resources, db.systems, async () => {
        for (const record of additions) await saveResource(record);
        const display = definition.display_name ? createEvaluator(definition.stats, next, undefined, { resources: [...resources, ...additions], resourceDefinitions: system.definition.resources, enumerations: system.definition.enumerated_types }).get(definition.display_name) : definition.name;
        if (typeof display !== 'string') throw new Error(it.invalidValue);
        await saveResource({ id: crypto.randomUUID(), systemKey: system.key, definitionId: definition.id, name: display.slice(0, 100) || definition.name, values: next, createdAt: new Date().toISOString() });
      });
    }
  }} /></>;
  return <form onSubmit={e => {
    e.preventDefault();
    if (busy || e.currentTarget.querySelector('[aria-invalid="true"]')) return;
    saving(true);
    void run(async () => {
      try {
        await db.transaction('rw', db.resources, db.systems, async () => {
          if (editing === 'new') {
            await saveResource({
              id: crypto.randomUUID(), systemKey: system.key, definitionId: definition.id,
              name: name.trim(), values, createdAt: new Date().toISOString()
            });
          } else {
            const latest = await db.resources.get(editing.id);
            if (!latest) throw new Error(it.missingResource);
            await saveResource({
              ...latest, name: name === editing.name ? latest.name : name.trim(),
              values: { ...latest.values, ...changes }
            });
          }
        });
        onDone();
      } finally { saving(false); }
    });
  }}>
    <fieldset disabled={busy} className="source-form-fields">
    <label className="field"><span>{it.resourceType}</span><select value={definition.id} disabled={editing !== 'new'} onChange={e => onSelect(e.target.value)}>
      {system.definition.resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select></label>
    <label className="field"><span>{it.resourceName}</span><input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
    <p className="muted">{it.manualHelp}</p>
    {definition.stats.filter(s => s.type === 'base').map(s => <FieldInput key={s.id} stat={s} value={values[s.id]} resources={resources}
      onSave={value => {
        const next = jsonValue(value);
        setValues(previous => ({ ...previous, [s.id]: next }));
        setChanges(previous => ({ ...previous, [s.id]: next }));
      }} />)}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onDone}>{it.cancel}</button><button className="button primary">{busy ? it.saving : it.saveResource}</button></div>
    </fieldset>
  </form>;
}
