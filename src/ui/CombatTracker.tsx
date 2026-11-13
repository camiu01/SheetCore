/** @file Local encounter UI driven by the pinned combat definition. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Character, Combat, ResourceInstance, StoredSystem } from '../domain/model';
import { combatContext, eligibleCombatants, initiativeOrder } from '../engine/combat';
import { commandCombat, createCombat, type CombatCommand } from '../persistence/combat';
import { db } from '../persistence/db';
import { commitCombatView, type ValuePatch } from '../persistence/views';
import { FieldInput } from './FieldInput';
import { RenderView } from './renderer';
import { Empty, Modal, PageHeading, SystemSelect, Warning, type Run } from './shared';
import { useUi } from './store';
import { it } from './it';

/** List and reopen persisted encounters. No initialization runs on read. */
export function CombatTracker({ systems, system, characters, run }: {
  systems: StoredSystem[]; system?: StoredSystem; characters: Character[]; run: Run;
}) {
  const combats = useLiveQuery(() => system ? db.combats.where('systemKey').equals(system.key).toArray() : [], [system?.key]) ?? [];
  const resources = useLiveQuery(() => system ? db.resources.where('systemKey').equals(system.key).toArray() : [], [system?.key]) ?? [];
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const combat = combats.find(c => c.id === selected) ?? combats[0];
  return <>
    <PageHeading eyebrow="AL TAVOLO / INCONTRI" title={it.combat} description={it.combatHelp} />
    <SystemSelect systems={systems} value={system?.key ?? ''} onChange={useUi.getState().selectSystem} />
    {!system?.definition.combat_system ? <Empty title={it.noCombatSystem} /> : <>
      <form className="combat-toolbar" onSubmit={e => {
        e.preventDefault(); void run(async () => { const result = await createCombat(system.key, name); setSelected(result.id); setName(''); });
      }}>
        <label className="field"><span>{it.combatName}</span><input value={name} required maxLength={100} onChange={e => setName(e.target.value)} /></label>
        <button className="button primary">{it.newCombat}</button>
      </form>
      {!combats.length ? <Empty title={it.noCombats} /> : <label className="field"><span>{it.combat}</span><select value={combat?.id ?? ''} onChange={e => setSelected(e.target.value)}>
        {combats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>}
      {combat && <CombatDetail key={combat.id} system={system} combat={combat} resources={resources}
        characters={characters.filter(c => c.systemKey === system.key)} run={run} />}
    </>}
  </>;
}
function CombatDetail({ system, combat, resources, characters, run }: {
  system: StoredSystem; combat: Combat; resources: ResourceInstance[]; characters: Character[]; run: Run;
}) {
  const [typeId, setTypeId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [partyOnly, setPartyOnly] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const execute = (command: CombatCommand) => void run(() => commandCombat(combat.id, command));
  try {
    const context = combatContext(system, combat, characters, resources);
    const definition = context.definition;
    const chosen = definition.combatant_types.find(t => t.id === typeId) ?? definition.combatant_types[0];
    const sources = chosen?.template_resource_id === 'character' ? characters
      : resources.filter(r => r.definitionId === chosen?.template_resource_id);
    const source = sources.find(s => s.id === sourceId) ?? sources[0];
    const order = initiativeOrder(combat);
    const eligible = eligibleCombatants(system, combat);
    const current = combat.status === 'active' && definition.initiative_system.has_turns ? eligible[combat.turn] : undefined;
    let resolution: unknown = null, resolutionError = '';
    try { if (definition.encounter_resolution_message && combat.round) resolution = context.encounter.evaluate(definition.encounter_resolution_message); }
    catch (e) { resolutionError = e instanceof Error ? e.message : String(e); }
    return <section>
      <div className="section-title"><h2>{combat.name}</h2><span>{combat.status === 'active' ? it.combatActive : combat.status === 'finished' ? it.combatFinished : it.combatPreparing}</span></div>
      <p className="muted">{it.round} {combat.round} · {it.pass} {combat.pass} · v{system.definition.version}</p>
      <Warning>{it.noEffectSupport}</Warning>
      {!!definition.difficulty_levels?.length && <label className="field"><span>{it.difficulty}</span><select value={combat.difficulty ?? ''} onChange={e => execute({ type: 'difficulty', value: e.target.value })}>
        {definition.difficulty_levels.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select></label>}
      {combat.status !== 'active' && <div className="combat-toolbar">
        <label className="field"><span>{it.combatantType}</span><select value={chosen?.id ?? ''} onChange={e => { setTypeId(e.target.value); setSourceId(''); }}>
          {definition.combatant_types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
        {chosen?.template_resource_id && <label className="field"><span>{it.combatantSource}</span><select value={source?.id ?? ''} onChange={e => setSourceId(e.target.value)}>
          {!sources.length && <option value="">{it.sourceRequired}</option>}
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>}
        <button className="button secondary" disabled={!chosen || (!!chosen.template_resource_id && !source)}
          onClick={() => chosen && execute({ type: 'add', typeId: chosen.id, sourceId: source?.id })}>{it.addCombatant}</button>
      </div>}
      <div className="combat-toolbar">
        <button className="button secondary" disabled={!combat.combatants.length || combat.status === 'active'} onClick={() => execute({ type: 'roll' })}>{it.rollInitiative}</button>
        <button className="button primary" disabled={!combat.combatants.length || order.unresolved || combat.status === 'active'} onClick={() => execute({ type: 'start' })}>{it.startCombat}</button>
        <button className="button primary" disabled={combat.status !== 'active'} onClick={() => execute({ type: 'next' })}>{definition.initiative_system.has_turns ? it.nextTurn : it.nextRound}</button>
        <button className="button secondary" disabled={combat.status === 'finished'} onClick={() => execute({ type: 'finish' })}>{it.finishCombat}</button>
        <button className="button secondary danger-text" onClick={() => setDeleting(true)}>{it.delete}</button>
      </div>
      {combat.combatants.some(f => f.initiative !== null) && order.unresolved && <Warning>{it.unresolvedInitiative}</Warning>}
      {resolution !== null && <div role="status" className="notice notice-success">{String(resolution)}</div>}
      {resolutionError && <Warning>{resolutionError}</Warning>}
      <label className="check-field"><input type="checkbox" checked={partyOnly} onChange={e => setPartyOnly(e.target.checked)} />{it.partyOnly}</label>
      {combat.combatants.filter(f => !partyOnly || definition.combatant_types.find(t => t.id === f.typeId)?.shows_in_party).map(f => {
        const scope = context.scopes.get(f.id)!;
        const type = definition.combatant_types.find(t => t.id === f.typeId)!;
        const evaluator = context.actor(f.id);
        let title = type.name;
        try { const name = evaluator.get('name'); if (typeof name === 'string' && name) title = name; } catch { /* The source may not declare a name stat. */ }
        const renderContext = { ...context.environment, systemKey: system.key, createdAt: scope.createdAt, stats: scope.stats, values: scope.values,
          overrides: scope.overrides, variables: { ...context.environment.variables, ...scope.variables },
          enumerations: system.definition.enumerated_types,
          onChange: (statId: string, value: unknown) => execute({ type: 'value', id: f.id, statId, value }),
          onCommit: (patch: ValuePatch, additions?: ResourceInstance[]) => commitCombatView(combat.id, f.id, patch, additions) };
        return <article key={f.id} className={`combatant-card ${current?.id === f.id ? 'combatant-current' : ''}`}>
          <div className="combat-meta"><h3>{title}</h3><span className="badge">{type.side}</span>{current?.id === f.id && <strong>{it.currentTurn}</strong>}</div>
          <label className="field"><span>{it.initiative} · {title}</span><input aria-label={`${it.initiative} · ${title}`} type="number" step={1} disabled={combat.status === 'active'}
            defaultValue={f.initiative ?? ''} key={String(f.initiative)} onBlur={e => {
              if (e.currentTarget.value.trim()) execute({ type: 'initiative', id: f.id, value: Number(e.currentTarget.value) });
            }} /></label>
          {type.card_view && <RenderView input={type.card_view} context={renderContext} />}
          {current?.id === f.id && type.header_view && <RenderView input={type.header_view} context={renderContext} />}
          <details className="base-editor"><summary>{it.baseValues} · {title}</summary><div className="base-grid">
            {scope.stats.filter(s => s.type === 'base').map(s => <FieldInput key={s.id} stat={s}
              value={Object.hasOwn(f.overrides, s.id) ? f.overrides[s.id] : scope.values[s.id]} resources={resources}
              onSave={value => execute({ type: 'value', id: f.id, statId: s.id, value })} />)}
          </div></details>
          {combat.status !== 'active' && <button className="link-button danger-text" onClick={() => execute({ type: 'remove', id: f.id })}>{it.removeCombatant}</button>}
        </article>;
      })}
      <details className="base-editor"><summary>{it.combatStats}</summary>
        {definition.stats.map(s => {
          try {
            const value = context.encounter.get(s.id);
            return <p key={s.id}><strong>{s.name}: </strong><output data-testid={`combat-stat-${s.id}`}>{Array.isArray(value) ? value.length : value === null ? '—' : String(value)}</output></p>;
          } catch (e) { return <p key={s.id} className="unsupported">{s.name}: {e instanceof Error ? e.message : String(e)}</p>; }
        })}
        {definition.is_encounter_within_difficulty_level && (() => {
          try { return <p>{context.encounter.evaluate(definition.is_encounter_within_difficulty_level) === true ? it.withinDifficulty : it.overDifficulty}</p>; }
          catch (e) { return <p className="unsupported">{String(e)}</p>; }
        })()}
      </details>
      {deleting && <Modal title={it.deleteCombat} onClose={() => setDeleting(false)}><button className="button danger" onClick={() => void run(async () => { await db.combats.delete(combat.id); setDeleting(false); })}>{it.delete}</button></Modal>}
    </section>;
  } catch (error) { return <Warning>{error instanceof Error ? error.message : String(error)}</Warning>; }
}
