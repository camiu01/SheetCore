/** @file Real scoped source drafts. Nothing is persisted before a successful Save. */
import { useRef, useState } from 'react';
import { matchesType, type ResourceInstance } from '../domain/model';
import { draftCalculations, initialDrafts, inputStat, sessionViews, validationMessages } from '../engine/view-session';
import { RenderView, type RenderContext } from './renderer';
import { it } from './it';

/** Stage one form, validate all source messages and submit one atomic patch. */
export function SourceForm({ input, context, onDone, onBusyChange, saveText = it.save, cancelText = it.cancel, showSave = true, showCancel = true }: {
  input: unknown; context: RenderContext; onDone: () => void;
  saveText?: string; cancelText?: string; showSave?: boolean; showCancel?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const sourceValues = context.previewValues ?? { ...context.values, ...context.overrides };
  const [drafts, setDrafts] = useState<Record<string, unknown>>(() => {
    try { return initialDrafts(input, context.stats, sourceValues); } catch { return {}; }
  });
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const latestChanges = useRef<Record<string, unknown>>({});
  const [additions, setAdditions] = useState<ResourceInstance[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  try {
    const nodes = sessionViews(input);
    const environment = { ...context, resources: [...(context.resources ?? []), ...additions],
      variables: { ...context.variables, $view: drafts, $edit_mode: true } };
    const errors = validationMessages(input, context.stats, context.values, drafts, environment);
    function update(id: string, value: unknown) {
      latestChanges.current = { ...latestChanges.current, [id]: value };
      setChanges(previous => ({ ...previous, [id]: value }));
      setDrafts(previous => ({ ...previous, ...Object.fromEntries(nodes.filter(v => inputStat(v, context.stats)?.id === id).map(v => [v.id, value])) }));
    }
    const formContext: RenderContext = {
      ...environment, drafts, previewValues: { ...sourceValues, ...changes }, validationErrors: errors, onChange: showSave ? update : undefined, onInput: showSave ? (_viewId, id, value) => update(id, value) : undefined,
      onCommit: showSave ? async (patch, created = []) => {
        const next = typeof patch === 'function' ? patch({ ...sourceValues, ...latestChanges.current }) : patch;
        for (const [id, value] of Object.entries(next)) update(id, value);
        setAdditions(previous => [...previous, ...created]);
      } : undefined
    };
    return <form onSubmit={event => {
      event.preventDefault(); event.stopPropagation();
      if (lock.current || Object.keys(errors).length || event.currentTarget.querySelector('[aria-invalid="true"],[data-view-error]')) return;
      lock.current = true; setBusy(true); onBusyChange?.(true); setError('');
      void (async () => {
        try {
          if (!context.onCommit) throw new Error(it.formReadOnly);
          for (const [id, value] of Object.entries(changes)) {
            const s = context.stats.find(s => s.id === id && s.type === 'base');
            if (!s || !matchesType(value, s.value_type, s.sub_value_type)) throw new Error(it.invalidValue);
          }
          await context.onCommit(changes, additions); onDone();
        } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
        finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
      })();
    }}>
      <fieldset disabled={busy} className="source-form-fields"><RenderView input={input} context={formContext} />
        <div className="base-grid">{draftCalculations(context.stats, drafts).map(s =>
          <RenderView key={s.id} input={{ id: `polysheet-derived-${s.id}`, type: 'stat', stat: s.id }} context={{ ...formContext, onChange: undefined, onInput: undefined }} />
        )}</div>
      </fieldset>
      {error && <p role="alert" className="error-text">{error}</p>}
      <div className="modal-actions">
        {showCancel && <button type="button" className="button secondary" disabled={busy} onClick={onDone}>{cancelText}</button>}
        {showSave && <button type="submit" className="button primary" disabled={busy || !context.onCommit || Object.keys(errors).length > 0}>{busy ? it.saving : saveText}</button>}
      </div>
    </form>;
  } catch (error) { return <p role="alert">{error instanceof Error ? error.message : String(error)}</p>; }
}
