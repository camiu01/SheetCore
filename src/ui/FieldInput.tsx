/** @file Typed base-field editors. Arrays and references are not raw JSON text. */
import { isResourceReference, type ResourceInstance, type Stat } from '../domain/model';
import { ScalarInput } from './renderer';
import { PhotoInput } from './PhotoInput';
import { it } from './it';

/** Edit one declared base value without converting resource links into notebook links. */
export function FieldInput({ stat, value, resources = [], onSave }: {
  stat: Stat; value: unknown; resources?: ResourceInstance[]; onSave: (value: unknown) => void;
}) {
  const current = value === undefined ? stat.default_value : value;
  if (['string', 'integer', 'decimal', 'bool'].includes(stat.value_type))
    return <ScalarInput key={`${stat.id}:${String(current)}`} stat={stat} value={current} onSave={onSave} />;
  if (stat.value_type === 'photo') return <PhotoInput label={stat.name} value={current} onSave={onSave} />;
  const eligible = resources.filter(r => !stat.resource_type || r.definitionId === stat.resource_type);
  if (stat.value_type === 'resource') return <label className="field"><span>{stat.name}</span>
    <select value={isResourceReference(current) ? current.resourceId : ''} onChange={e => onSave(e.target.value ? { resourceId: e.target.value } : null)}>
      <option value="">{it.choose}</option>
      {eligible.map(r => <option key={r.id} value={r.id}>{r.name} · {r.definitionId}</option>)}
    </select>
  </label>;
  if (stat.value_type === 'array') {
    const values = Array.isArray(current) ? current : [];
    if (stat.sub_value_type === 'resource') return <fieldset className="field reference-options"><legend>{stat.name}</legend>
      {!eligible.length && <small className="muted">{it.createResourcesFirst}</small>}
      {eligible.map(r => <label key={r.id} className="check-field"><input type="checkbox"
        checked={values.some(v => isResourceReference(v) && v.resourceId === r.id)}
        onChange={e => onSave(e.target.checked ? [...values, { resourceId: r.id }] : values.filter(v => !isResourceReference(v) || v.resourceId !== r.id))} />{r.name} · {r.definitionId}</label>)}
    </fieldset>;
    if (['string', 'integer', 'decimal', 'bool'].includes(stat.sub_value_type ?? '')) return <fieldset className="field"><legend>{stat.name}</legend>
      {values.map((v, i) => <div key={i} className="array-item"><ScalarInput key={`${i}:${String(v)}`} stat={{ ...stat, id: `${stat.id}-${i}`, name: `${stat.name} ${i + 1}`, value_type: stat.sub_value_type! }}
        value={v} onSave={next => onSave(values.map((old, index) => index === i ? next : old))} />
        <button type="button" className="link-button danger-text" aria-label={`${it.delete} ${stat.name} ${i + 1}`} onClick={() => onSave(values.filter((_, index) => index !== i))}>{it.delete}</button></div>)}
      <button type="button" className="button secondary" disabled={values.length >= 1000} onClick={() => onSave([...values, stat.sub_value_type === 'string' ? '' : stat.sub_value_type === 'bool' ? false : 0])}>{it.addValue}</button>
    </fieldset>;
  }
  return <p className="unsupported">{stat.name}: {it.unsupported} ({stat.value_type})</p>;
}
