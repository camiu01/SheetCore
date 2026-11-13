/**
 * @file Source-driven, text-only view rendering with explicit unsupported markers.
 * @remarks Sheet inputs commit on blur; source forms own explicit `$view` drafts.
 */
import { Component, useState, type ReactNode, type CSSProperties } from 'react';
import { createEvaluator, type EvaluationEnvironment } from '../engine/formulas';
import { formula, object, view, type Stat, type View } from '../domain/model';
import { unsupportedViewOptions, viewFields } from '../importing/system';
import { it } from './it';
import { PhotoInput } from './PhotoInput';
import { inputValue, saveInput, sourceColor, sourceIcons, textValue } from './view-support';
import { SourcePopup, SourceResourceSelect, SourceResourceSection, DeferredResourceSelect } from './SourceViews';
import { SourceCollapsible, SourceViewPager } from './SourceLayoutViews';
import { SourceButton, SourceMenuButton, SourceSelect, SourceTicker } from './SourceValueViews';
import { SourceResourceArray, SourceResourceView } from './SourceResourceViews';
import type { ValuePatch } from '../persistence/views';
import type { ResourceInstance } from '../domain/model';

export { textValue, sourceColor };


export interface RenderContext extends EvaluationEnvironment {
  stats: Stat[];
  values: Record<string, unknown>;
  onChange?: (id: string, value: unknown) => void;
  systemKey?: string;
  onCommit?: (patch: ValuePatch, additions?: ResourceInstance[]) => Promise<void>;
  drafts?: Record<string, unknown>;
  validationErrors?: Record<string, string>;
  onInput?: (viewId: string, statId: string, value: unknown) => void;
  previewValues?: Record<string, unknown>;
  /** Raw `enumerated_types`; used by select and menu options only. */
  enumerations?: unknown[];
}
/** Edit one supported scalar. Invalid numeric drafts never reach persistence. */
export function ScalarInput({ stat, value, onSave, onDraft, label, min, max, maxLength, hint, step }: {
  stat: Stat; value: unknown; onSave: (v: string | number | boolean) => void;
  label?: string; min?: number; max?: number; maxLength?: number; hint?: string; step?: number;
  onDraft?: (v: string | number) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  const caption = label ?? stat.name;
  function change(text: string) {
    setDraft(text);
    if (onDraft) onDraft(stat.value_type === 'string' ? text : text.trim() ? Number(text) : NaN);
  }
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
          onChange={e => change(e.target.value)} onBlur={commit} />
      : <input aria-label={caption} aria-invalid={!!error} type="number" step={step ?? (stat.value_type === 'integer' ? 1 : 'any')}
          min={min} max={max} value={draft} onChange={e => change(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
    {error && <small role="alert" className="error-text">{error}</small>}
  </label>;
}
type Renderer = (v: View, ctx: RenderContext, evaluate: (v: unknown) => unknown) => ReactNode;
function children(items: unknown, ctx: RenderContext) {
  if (!Array.isArray(items)) throw new Error('Lista di componenti non valida');
  return items.map((v, i) => <RenderView key={String(object(v).id ?? i)} input={v} context={ctx} />);
}
function resourceText(v: View, ctx: RenderContext) {
  if (v.resource_id == null) return undefined;
  const d = ctx.resourceDefinitions?.find(d => d.id === v.resource_id);
  if (!d || typeof v.resource_instance_ids_stat !== 'string') throw new Error(it.noResourceType);
  const value = createEvaluator(ctx.stats, ctx.values, undefined, ctx).get(v.resource_instance_ids_stat);
  return (Array.isArray(value) ? value : [value]).filter(id => id != null).map(id => {
    const r = ctx.resources?.find(r => r.id === id && r.definitionId === d.id && (!ctx.systemKey || r.systemKey === ctx.systemKey));
    if (!r) throw new Error(it.missingResource);
    const display = typeof v.resource_display_stat === 'string' ? v.resource_display_stat : d.display_name;
    return display ? textValue(createEvaluator(d.stats, r.values, undefined, { resources: ctx.resources, resourceDefinitions: ctx.resourceDefinitions, createdAt: r.createdAt }).get(display)) : r.name;
  }).join(', ');
}
const sourceIconEntries = Object.entries(sourceIcons);
function size(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(800, Math.max(0, value)) : fallback;
}
function align(value: unknown): 'flex-start' | 'center' | 'flex-end' {
  return value === 'end' ? 'flex-end' : value === 'center' ? 'center' : 'flex-start';
}
/** Extensible view registry. Unknown types produce a marker, not an invented UI. */
export const rendererRegistry = new Map<string, Renderer>([
  ['icon', v => {
    const entry = sourceIconEntries.find(([name]) => name === v.name);
    if (!entry) throw new Error(`${it.unsupported}: ${String(v.name)}`);
    const Icon = entry[1];
    return <Icon aria-hidden="true" size={v.size === 'small' ? 18 : v.size === 'large' ? 32 : 24} color={sourceColor(v.color)} />;
  }],
  ['collapsible', (v, ctx, e) => <SourceCollapsible node={v} context={ctx} evaluate={e} />],
  ['viewPager', (v, ctx, e) => <SourceViewPager node={v} context={ctx} evaluate={e} />],
  ['ticker', (v, ctx, e) => <SourceTicker node={v} context={ctx} evaluate={e} />],
  ['button', (v, ctx, e) => <SourceButton node={v} context={ctx} evaluate={e} />],
  ['select', (v, ctx, e) => <SourceSelect node={v} context={ctx} evaluate={e} />],
  ['menuButton', (v, ctx, e) => <SourceMenuButton node={v} context={ctx} evaluate={e} />],
  ['resource', (v, ctx) => <SourceResourceView node={v} context={ctx} />],
  ['resourceArray', (v, ctx) => <SourceResourceArray node={v} context={ctx} />],
  ['avatarSection', (v, ctx, e) => <section className="source-avatar-section">
    <div className="source-avatar-center">{children(v.center_content, ctx)}</div>
    <div className="source-avatar-stacks"><div>{children(v.bottom_left_stack ?? [], ctx)}</div><div>{children(v.bottom_right_stack ?? [], ctx)}</div></div>
    {['left', 'right'].map(side => v[`bottom_${side}_button_title`] != null && <p key={side} className="unsupported-note">{textValue(e(v[`bottom_${side}_button_title`]))} · {it.unsupportedEvent}</p>)}
  </section>],
  ['popUpButton', (v, ctx) => <SourcePopup node={v} context={ctx} />],
  ['selectResources', (v, ctx) => !ctx.drafts && v.should_save_on_selection !== true ? <DeferredResourceSelect node={v} context={ctx} /> : <SourceResourceSelect node={v} context={ctx} />],
  ['resourceSection', (v, ctx) => <SourceResourceSection node={v} context={ctx} />],
  ['chip', (v, ctx, e) => <span className={`source-chip ${v.style === 'compact' ? 'source-chip-compact' : ''}`} style={{ backgroundColor: sourceColor(v.background_color), borderColor: sourceColor(v.border_color) }}>{resourceText(v, ctx) ?? (v.text ? textValue(e(v.text)) : '')}</span>],
  ['listItem', (v, _ctx, e) => <div className="source-list-item">
    <div><strong style={{ color: sourceColor(v.title_color && e(v.title_color)) }}>{v.title ? textValue(e(v.title)) : ''}</strong>
      <span style={{ color: sourceColor(v.first_line_extra_color && e(v.first_line_extra_color)) }}>{v.first_line_extra ? textValue(e(v.first_line_extra)) : ''}</span></div>
    <div><p style={{ color: sourceColor(v.subtitle_color && e(v.subtitle_color)) }}>{v.subtitle ? textValue(e(v.subtitle)) : ''}</p>
      <span style={{ color: sourceColor(v.second_line_extra_color && e(v.second_line_extra_color)) }}>{v.second_line_extra ? textValue(e(v.second_line_extra)) : ''}</span></div>
  </div>],
  ['text', (v, ctx, e) => {
    if (typeof v.edit_stat === 'string') {
      const stat = ctx.stats.find(s => s.id === v.edit_stat);
      if (!stat || stat.type !== 'base' || !['string', 'integer', 'decimal', 'bool'].includes(stat.value_type)) throw new Error('Campo non modificabile');
      if (ctx.onChange) return <ScalarInput key={ctx.drafts ? v.id : `${stat.id}:${String(ctx.values[stat.id])}`} stat={stat}
        value={inputValue(v, ctx, stat)}
        label={v.label ? textValue(e(v.label)) : stat.name}
        hint={v.hint ? textValue(e(v.hint)) : undefined}
        maxLength={typeof v.max_length === 'number' ? Math.min(10000, Math.max(1, v.max_length)) : undefined}
        onDraft={ctx.onInput ? value => saveInput(v, ctx, stat.id, value) : undefined}
        onSave={value => saveInput(v, ctx, stat.id, value)} />;
    }
    const value = resourceText(v, ctx) ?? (v.text ? e(v.text) : '');
    return <p className={`view-text view-text-${String(v.style ?? 'text')}`} style={{ fontWeight: v.bold === true ? 700 : undefined, color: sourceColor(v.color),
      ...(typeof v.max_lines === 'number' && v.max_lines > 0 ? { display: '-webkit-box', WebkitLineClamp: Math.min(100, Math.floor(v.max_lines)), WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {})
    }}>{typeof value === 'number' && v.signed === true && value >= 0 ? `+${value}` : textValue(value)}</p>;
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
      {ctx.onChange && edit && <ScalarInput key={ctx.drafts ? v.id : `${edit.id}:${String(ctx.values[edit.id])}`} stat={edit}
        value={inputValue(v, ctx, edit)}
        label={`${it.edit} ${edit.name}`}
        step={typeof v.change_amount === 'number' ? v.change_amount : undefined}
        min={typeof v.min_value_allowed === 'number' ? v.min_value_allowed : undefined}
        max={typeof v.max_value_allowed === 'number' ? v.max_value_allowed : undefined}
        onDraft={ctx.onInput ? value => saveInput(v, ctx, edit.id, value) : undefined}
        onSave={value => saveInput(v, ctx, edit.id, value)} />}
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
      ? <details className={`sheet-section ${v.always_show_collapse_icon !== true ? 'collapse-icon-closed-only' : ''}`} open={v.start_collapsed !== true}><summary>{header}</summary>{content}</details>
      : <section className="sheet-section">{header}{content}</section>;
  }],
  ['list', (v, ctx) => <div className="view-list" style={{ padding: size(v.padding), paddingTop: v.padding_top == null ? undefined : size(v.padding_top), paddingRight: v.padding_right == null ? undefined : size(v.padding_right), paddingBottom: v.padding_bottom == null ? undefined : size(v.padding_bottom), paddingLeft: v.padding_left == null ? undefined : size(v.padding_left), alignItems: align(v.alignment) }}>{children(v.subviews, ctx)}</div>],
  ['composite', (v, ctx) => <div className="view-composite" style={{ justifyContent: align(v.alignment), flexWrap: v.row_only === true ? 'nowrap' : 'wrap' }}>{children(v.subviews, ctx)}</div>],
  ['divider', () => <hr />], ['spacer', () => <span className="spacer" />],
  ['checkbox', (v, ctx, e) => {
    const stat = ctx.stats.find(s => s.id === v.stat && s.type === 'base' && s.value_type === 'bool');
    if (!stat) throw new Error('Checkbox senza statistica booleana base');
    return <label className={`check-field ${v.label_alignment === 'left' ? 'check-label-left' : ''}`}><input type="checkbox" checked={inputValue(v, ctx, stat) === true}
      disabled={!ctx.onChange || (v.enabled != null && e(v.enabled) !== true)}
      onChange={event => saveInput(v, ctx, stat.id, event.target.checked)} />{v.label ? textValue(e(v.label)) : stat.name}</label>;
  }]
]);
interface ViewProps { input: unknown; context: RenderContext }
/** Catch deferred React child failures too; retry when inputs or their snapshot change. */
class ViewErrorBoundary extends Component<ViewProps & { children: ReactNode }, ViewProps & { error: string | null }> {
  state: ViewProps & { error: string | null } = { input: this.props.input, context: this.props.context, error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  static getDerivedStateFromProps(props: ViewProps, state: ViewProps) {
    return props.input !== state.input || props.context !== state.context
      ? { input: props.input, context: props.context, error: null } : null;
  }
  render() {
    return this.state.error !== null
      ? <div role="status" data-view-error className="unsupported"><p>{it.viewUnavailable}</p>{this.state.error}</div>
      : this.props.children;
  }
}
/** Safely render one node and its React descendants; failures stay local and visible. */
export function RenderView(props: ViewProps) {
  return <ViewErrorBoundary input={props.input} context={props.context}><ViewContent {...props} /></ViewErrorBoundary>;
}
function ViewContent({ input, context }: ViewProps) {
  // `$edit_mode` is true only inside a real draft session, never during sheet rendering.
  const environment: RenderContext = { ...context, variables: { $edit_mode: context.drafts !== undefined, ...context.variables } };
  try {
    const v = view(input);
    const options = unsupportedViewOptions(v);
    if (options.length) throw new Error(`${it.unsupported}: ${options.join(', ')}`);
    const e = createEvaluator(environment.stats, environment.values, undefined, environment).evaluate;
    if (v.is_visible != null) {
      const visible = e(formula(v.is_visible));
      if (typeof visible !== 'boolean') throw new Error('is_visible deve restituire bool');
      if (!visible) return null;
    }
    const handler = rendererRegistry.get(v.type);
    if (!handler) return <div className="unsupported"><strong>{it.unsupported}: {v.type}</strong><small>{v.id}</small></div>;
    if (v.validation_message != null && !context.drafts && context.onChange)
      return <DeferredResourceSelect node={v} context={environment} />;
    const ignored = Object.keys(v).filter(k => v[k] != null && !['id', 'type', 'is_visible', 'validation_message', 'margin_left', 'margin_right', 'margin_top', 'margin_bottom', ...viewFields[v.type]].includes(k));
    const style: CSSProperties = {
      marginLeft: size(v.margin_left), marginRight: size(v.margin_right),
      marginTop: size(v.margin_top), marginBottom: size(v.margin_bottom)
    };
    return <div className="view-wrapper" style={style}>
      {handler(v, environment, e)}
      {context.validationErrors?.[v.id] && <p role="alert" className="error-text">{context.validationErrors[v.id]}</p>}
      {v.validation_message != null && !context.drafts && <small className="unsupported-note">{it.validationRequiresForm}</small>}
      {ignored.length > 0 && <small className="unsupported-note">{it.unsupported}: {ignored.join(', ')}</small>}
    </div>;
  } catch (error) {
    return <div role="status" data-view-error className="unsupported">{error instanceof Error ? error.message : String(error)}</div>;
  }
}
