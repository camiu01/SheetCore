/** @file Manual typed resource editing, including nested references and local photos. */
import { useState } from 'react';
import { jsonValue, type ResourceDefinition, type ResourceInstance, type StoredSystem } from '../domain/model';
import { initialValues } from '../persistence/db';
import { saveResource } from '../persistence/resources';
import { FieldInput } from './FieldInput';
import { it } from './it';
import type { Run } from './shared';

/** Stage fields locally and validate the complete resource before one atomic save. */
export function ResourceEditor({ system, definition, editing, resources, onSelect, onDone, run }: {
  system: StoredSystem; definition: ResourceDefinition; editing: ResourceInstance | 'new';
  resources: ResourceInstance[]; onSelect: (id: string) => void; onDone: () => void; run: Run;
}) {
  const [values, setValues] = useState(() => editing === 'new' ? initialValues(definition.stats) : editing.values);
  const [name, setName] = useState(editing === 'new' ? '' : editing.name);
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
