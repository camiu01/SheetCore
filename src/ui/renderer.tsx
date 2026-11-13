/**
 * @file Source-driven, text-only view rendering with explicit unsupported markers.
 * @remarks Inputs commit on blur. Their local drafts are not a `$view` rule scope.
 */
import { useState, type ReactNode, type CSSProperties } from 'react';
import { createEvaluator, type EvaluationEnvironment } from '../engine/formulas';
import { formula, object, view, type Stat, type View } from '../domain/model';
import { viewFields } from '../importing/system';
import { it } from './it';
import { PhotoInput } from './PhotoInput';

export interface RenderContext extends EvaluationEnvironment {
  stats: Stat[];
  values: Record<string, unknown>;
  onChange?: (id: string, value: unknown) => void;
}
/** Edit one supported scalar. Invalid numeric drafts never reach persistence. */
export function ScalarInput({ stat, value, onSave, label, min, max, maxLength, hint, step }: {
  stat: Stat; value: unknown; onSave: (v: string | number | boolean) => void;
  label?: string; min?: number; max?: number; maxLength?: number; hint?: string; step?: number;
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  const caption = label ?? stat.name;
  if (stat.value_type === 'bool') return <label className="check-field">
    <input type="checkbox" checked={value === true} onChange={e => onSave(e.target.checked)} />{caption}
  </label>;
  function commit() {
    const numeric = ['integer', 'decimal'].includes(stat.value_type);
    const next = numeric ? Number(draft) : draft;
    if (numeric && (!draft.trim() || !Number.isFinite(next) || (stat.value_type === 'integer' && !Number.isSafeInteger(next)) ||
      (min !== undefined && Number(next) < min) || (max !== undefined && Number(next) > max))) {
      setError(it.invalidNumber); return;
    }
    setError('');
    if (next !== value) onSave(next);
  }
  return <label className="field">
    <span>{caption}</span>
    {stat.value_type === 'string'
      ? <textarea aria-label={caption} aria-invalid={!!error} value={draft} maxLength={maxLength ?? 10000} placeholder={hint} rows={maxLength && maxLength <= 100 ? 1 : 3}
          onChange={e => setDraft(e.target.value)} onBlur={commit} />
      : <input aria-label={caption} aria-invalid={!!error} type="number" step={step ?? (stat.value_type === 'integer' ? 1 : 'any')}
          min={min} max={max} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
    {error && <small role="alert" className="error-text">{error}</small>}
  </label>;
}
type Renderer = (v: View, ctx: RenderContext, evaluate: (v: unknown) => unknown) => ReactNode;
function children(items: unknown, ctx: RenderContext) {
  if (!Array.isArray(items)) throw new Error('Lista di componenti non valida');
  return items.map((v, i) => <RenderView key={String(object(v).id ?? i)} input={v} context={ctx} />);
}
function textValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') throw new Error('Valore complesso non visualizzabile come testo');
  return String(value);
}
function size(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(800, Math.max(0, value)) : fallback;
}
function align(value: unknown): 'flex-start' | 'center' | 'flex-end' {
  return value === 'end' ? 'flex-end' : value === 'center' ? 'center' : 'flex-start';
}
/** Extensible view registry. Unknown types produce a marker, not an invented UI. */
export const rendererRegistry = new Map<string, Renderer>([
  ['text', (v, ctx, e) => {
    if (typeof v.edit_stat === 'string') {
      const stat = ctx.stats.find(s => s.id === v.edit_stat);
      if (!stat || stat.type !== 'base' || !['string', 'integer', 'decimal', 'bool'].includes(stat.value_type)) throw new Error('Campo non modificabile');
      if (ctx.onChange) return <ScalarInput key={`${stat.id}:${String(ctx.values[stat.id])}`} stat={stat}
        value={ctx.values[stat.id] ?? stat.default_value}
        label={v.label ? textValue(e(v.label)) : stat.name}
        hint={v.hint ? textValue(e(v.hint)) : undefined}
        maxLength={typeof v.max_length === 'number' ? Math.min(10000, Math.max(1, v.max_length)) : undefined}
        onSave={value => ctx.onChange?.(stat.id, value)} />;
    }
    return <p className={`view-text view-text-${String(v.style ?? 'text')}`} style={{ fontWeight: v.bold === true ? 700 : undefined }}>{v.text ? textValue(e(v.text)) : ''}</p>;
  }],
  ['stat', (v, ctx, e) => {
    const stat = ctx.stats.find(s => s.id === v.stat);
    if (!stat) throw new Error(`Statistica mancante: ${String(v.stat)}`);
    const evaluator = createEvaluator(ctx.stats, ctx.values, undefined, ctx);
    const value = evaluator.get(stat.id);
    const editId = typeof v.edit_stat === 'string' ? v.edit_stat : stat.id;
    const edit = ctx.stats.find(s => s.id === editId && s.type === 'base' && ['integer', 'decimal', 'string', 'bool'].includes(s.value_type));
    const name = v.override_label ? textValue(e(v.override_label)) : stat.name;
    const shown = typeof value === 'number' && v.always_show_sign === true && value >= 0 ? `+${value}` : textValue(value);
    return <div className={`stat-block ${v.style === 'list' ? 'stat-list' : ''}`}>
      <span className="stat-label">{name}</span>
      <output data-testid={`stat-${stat.id}`} className="stat-value">{shown || '—'}</output>
      {stat.type === 'calculated' && <small className="calculated">{it.calculated}</small>}
      {ctx.onChange && edit && <ScalarInput key={`${edit.id}:${String(ctx.values[edit.id])}`} stat={edit}
        value={Object.hasOwn(ctx.values, edit.id) ? ctx.values[edit.id] : edit.default_value}
        label={`${it.edit} ${edit.name}`}
        step={typeof v.change_amount === 'number' ? v.change_amount : undefined}
        min={typeof v.min_value_allowed === 'number' ? v.min_value_allowed : undefined}
        max={typeof v.max_value_allowed === 'number' ? v.max_value_allowed : undefined}
        onSave={value => ctx.onChange?.(edit.id, value)} />}
    </div>;
  }],
  ['avatar', (v, ctx, e) => {
    if (typeof v.name_stat !== 'string') throw new Error('avatar richiede name_stat');
    const name = textValue(e({ type: 'stat', stat: v.name_stat }));
    const photo = typeof v.photo_stat === 'string' ? e({ type: 'stat', stat: v.photo_stat }) : null;
    const editable = ctx.stats.find(s => s.id === v.photo_stat && s.type === 'base' && s.value_type === 'photo');
    return <PhotoInput label={name || it.choosePhoto} value={photo} preview={v.preview_enabled === true}
      size={typeof v.size === 'string' ? v.size : 'medium'}
      onSave={v.interactable === true && editable && ctx.onChange ? value => ctx.onChange?.(editable.id, value) : undefined} />;
  }],
  ['section', (v, ctx) => {
    const header = <div className={`section-heading ${v.show_divider === false ? 'no-divider' : ''}`}>{children(v.header, ctx)}</div>;
    const width = typeof v.content_item_min_width === 'number' ? v.content_item_min_width : 160;
    const minimum = width > 0 && width <= 1 ? `${width * 100}%` : `${size(width, 160)}px`;
    const content = <div className="section-content" style={{
      gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${minimum}),1fr))`,
      justifyItems: align(v.alignment ?? 'center')
    }}>{children(v.content, ctx)}</div>;
    return v.collapsible === true
      ? <details className="sheet-section" open={v.start_collapsed !== true}><summary>{header}</summary>{content}</details>
      : <section className="sheet-section">{header}{content}</section>;
  }],
  ['list', (v, ctx) => <div className="view-list" style={{ padding: size(v.padding), alignItems: align(v.alignment) }}>{children(v.subviews, ctx)}</div>],
  ['composite', (v, ctx) => <div className="view-composite" style={{ justifyContent: align(v.alignment), flexWrap: v.row_only === true ? 'nowrap' : 'wrap' }}>{children(v.subviews, ctx)}</div>],
  ['divider', () => <hr />], ['spacer', () => <span className="spacer" />],
  ['checkbox', (v, ctx, e) => {
    const stat = ctx.stats.find(s => s.id === v.stat && s.type === 'base' && s.value_type === 'bool');
    if (!stat) throw new Error('Checkbox senza statistica booleana base');
    return <label className="check-field"><input type="checkbox" checked={(ctx.values[stat.id] ?? stat.default_value) === true}
      disabled={!ctx.onChange || (v.enabled != null && e(v.enabled) !== true)}
      onChange={event => ctx.onChange?.(stat.id, event.target.checked)} />{v.label ? textValue(e(v.label)) : stat.name}</label>;
  }]
]);
/** Safely render one node and its children; evaluation failures remain visible. */
export function RenderView({ input, context }: { input: unknown; context: RenderContext }) {
  try {
    const v = view(input);
    const e = createEvaluator(context.stats, context.values, undefined, context).evaluate;
    if (v.is_visible != null) {
      const visible = e(formula(v.is_visible));
      if (typeof visible !== 'boolean') throw new Error('is_visible deve restituire bool');
      if (!visible) return null;
    }
    const handler = rendererRegistry.get(v.type);
    if (!handler) return <div className="unsupported"><strong>{it.unsupported}: {v.type}</strong><small>{v.id}</small></div>;
    const ignored = Object.keys(v).filter(k => !['id', 'type', 'is_visible', 'margin_left', 'margin_right', 'margin_top', 'margin_bottom', ...viewFields[v.type]].includes(k));
    const style: CSSProperties = {
      marginLeft: size(v.margin_left), marginRight: size(v.margin_right),
      marginTop: size(v.margin_top), marginBottom: size(v.margin_bottom)
    };
    return <div className="view-wrapper" style={style}>
      {handler(v, context, e)}
      {ignored.length > 0 && <small className="unsupported-note">{it.unsupported}: {ignored.join(', ')}</small>}
    </div>;
  } catch (error) {
    return <div role="status" className="unsupported">{error instanceof Error ? error.message : String(error)}</div>;
  }
}
