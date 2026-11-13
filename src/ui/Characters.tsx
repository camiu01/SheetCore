/** @file Manual character creation and source-generated character sheets. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { object, type Character, type StoredSystem, type View } from '../domain/model';
import { db, createCharacter, detachResource, setCharacterValue } from '../persistence/db';
import { RenderView } from './renderer';
import { FieldInput } from './FieldInput';
import { CompatibilityBadge, Empty, Modal, PageHeading, SystemSelect, Warning, type Run } from './shared';
import { it } from './it';
import { useUi } from './store';
import { commitCharacterView } from '../persistence/views';
import { manualFieldGroup, sessionViews } from '../engine/view-session';
import { SourceForm } from './SourceForm';

/** List persisted characters; creation never claims to execute the official flow. */
export function Characters({ systems, characters, run }: { systems: StoredSystem[]; characters: Character[]; run: Run }) {
  const { search, setSearch, openCharacter, navigate, systemKey, selectSystem } = useUi();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedKey = systems.some(s => s.key === systemKey) ? systemKey : systems[0]?.key ?? '';
  const filtered = characters.filter(c => c.name.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it')));
  return <>
    <PageHeading eyebrow={it.charactersEyebrow} title={it.allCharacters} description={it.characterSubtitle}
      action={<button className="button primary" onClick={() => systems.length ? setCreating(true) : navigate('systems')}><Plus size={18} />{it.newCharacter}</button>} />
    <div className="character-toolbar"><div className="tab-label"><span className="tab-dot" />{it.allCharactersTab} <span className="count">{characters.length}</span></div>
      <label className="search"><Search size={17} /><input aria-label={it.search} placeholder={it.search} value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    {characters.length === 0 ? <>
      <Empty title={it.emptyCharacters} action={<button className="button secondary" onClick={() => navigate('systems')}><BookOpen size={17} />{it.importSystem}</button>}>{it.emptyCharactersHelp}</Empty>
      <div className="getting-started"><span className="step-number">01</span><div><strong>{it.chooseRules}</strong><p className="muted">{it.chooseRulesHelp}</p></div><button className="icon-button" aria-label={it.systems} onClick={() => navigate('systems')}><ArrowUpRight /></button></div>
    </> : filtered.length ? <div className="character-grid">{filtered.map((c, index) => {
      const s = systems.find(s => s.key === c.systemKey);
      return <button className="character-card" key={c.id} onClick={() => openCharacter(c.id)}>
        <div className={`character-art art-${index % 3}`} aria-hidden="true"><div className="character-monogram">{c.name.slice(0, 1).toLocaleUpperCase('it')}</div><span className="art-orbit" /><span className="art-star">✧</span><span className="character-system">{s?.definition.abbreviation ?? '?'}</span></div>
        <div className="character-card-body"><div className="card-title-row"><h2>{c.name}</h2><ArrowUpRight size={19} /></div><p className="muted">{s?.definition.name} · v{s?.definition.version}</p>
          <div className="character-card-meta"><span><i />{it.saved}</span><small>{new Date(c.updatedAt).toLocaleDateString('it')}</small></div>
          {s && <CompatibilityBadge system={s} />}</div>
      </button>;
    })}<button className="add-character-card" onClick={() => setCreating(true)}><Plus size={28} /><span>{it.newCharacter}</span><small>{it.anotherStory}</small></button></div> : <Empty title={it.noResults} />}
    <div className="privacy-strip"><Check size={16} /><span>{it.local}.</span><span className="muted">{it.noAccount}</span></div>
    {creating && <Modal title={it.newCharacter} onClose={() => setCreating(false)}><form onSubmit={e => {
      e.preventDefault(); if (busy) return; setBusy(true);
      void run(async () => {
        try {
          const system = systems.find(s => s.key === selectedKey);
          if (!system) throw new Error(it.noSystemSelected);
          const c = await createCharacter(system, name); setCreating(false); openCharacter(c.id);
        } finally { setBusy(false); }
      });
    }}>
      <div className="manual-label"><UserRound size={17} />{it.manual}</div><p className="muted">{it.manualHelp}</p>
      <SystemSelect systems={systems} value={selectedKey} onChange={selectSystem} />
      <label className="field"><span>{it.name}</span><input value={name} onChange={e => setName(e.target.value)} maxLength={100} required autoFocus placeholder={it.namePlaceholder} /></label>
      {systems.find(s => s.key === selectedKey)?.diagnostics.length !== 0 && <Warning>{it.rulesWarning}</Warning>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setCreating(false)}>{it.cancel}</button><button className="button primary" disabled={busy}>{it.create}</button></div>
    </form></Modal>}
  </>;
}
/** Render only the pinned source definitions; all writes patch the latest DB record. */
export function CharacterSheet({ character, system, run }: { character: Character; system: StoredSystem; run: Run }) {
  const { navigate } = useUi();
  const [deleting, setDeleting] = useState(false);
  const [sourceGroup, setSourceGroup] = useState<View | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const resources = useLiveQuery(() => db.resources.where('systemKey').equals(system.key).toArray(), [system.key]) ?? [];
  const change = (id: string, value: unknown) => { void run(() => setCharacterValue(character.id, id, value)); };
  const context = {
    stats: system.definition.character_stats, values: character.values, onChange: change,
    systemKey: system.key, createdAt: character.createdAt, resources, resourceDefinitions: system.definition.resources,
    onCommit: (patch: import('../persistence/views').ValuePatch, additions?: import('../domain/model').ResourceInstance[]) => commitCharacterView(character.id, patch, additions)
  };
  const groups = system.definition.character_creation_flow.flatMap(page => {
    try { return sessionViews(object(page).view).filter(v => v.type === 'section' && Array.isArray(v.content) && v.content.some(c => object(c).type === 'stat')); }
    catch { return []; }
  });
  return <>
    <button className="link-button back-link" onClick={() => navigate('characters')}><ArrowLeft size={17} />{it.back}</button>
    <PageHeading eyebrow={`${system.definition.name.toLocaleUpperCase('it')} / ${it.manual.toLocaleUpperCase('it')}`} title={character.name}
      description={`v${system.definition.version} · ${system.digest.slice(0, 8)} · ${it.saved}`}
      action={<button className="button secondary danger-text" onClick={() => setDeleting(true)}><Trash2 size={17} />{it.delete}</button>} />
    {system.diagnostics.length > 0 && <Warning>{it.rulesWarning} <button className="link-button" onClick={() => { useUi.getState().selectSystem(system.key); navigate('diagnostics'); }}>{it.diagnostics}</button></Warning>}
    <div className="sheet-layout"><div className="sheet-main">
      <div className="section-title"><h2>{it.sheet}</h2><span className="small-label">{it.generatedBySystem}</span></div>
      {system.definition.character_sheet_sections.map(section => <RenderView key={section.id} input={section.view} context={context} />)}
      {groups.length > 0 && <details className="base-editor"><summary>{it.sourceFormGroups}</summary><p className="muted">{it.sourceFormHelp}</p>
        {groups.map((v, i) => <button className="button secondary" key={`${v.id}:${i}`} onClick={() => setSourceGroup(v)}>{it.edit} · {v.id}</button>)}
      </details>}
      {sourceGroup && <Modal title={`${it.edit} · ${sourceGroup.id}`} onClose={() => !formBusy && setSourceGroup(null)}>
        <p className="muted">{it.sourceFormHelp}</p><SourceForm input={manualFieldGroup(sourceGroup)} context={context} onBusyChange={setFormBusy} onDone={() => setSourceGroup(null)} />
      </Modal>}
      {!system.definition.character_sheet_sections.length && <Warning>{it.noSections}</Warning>}
      <details className="base-editor"><summary>{it.baseValues}</summary><p className="muted">{it.baseHelp}</p><div className="base-grid">
        {system.definition.character_stats.filter(s => s.type === 'base').map(s => <FieldInput key={s.id} stat={s} value={character.values[s.id]} resources={resources} onSave={value => change(s.id, value)} />)}
      </div></details>
    </div><aside className="sheet-aside"><div className="aside-note"><p className="eyebrow">{it.yourArchive}</p><h2>{it.assigned}</h2><p className="muted">{it.resourceHelp}</p>
      {!character.resourceIds.length && <p>{it.noAssigned}</p>}
      {character.resourceIds.map(id => {
        const resource = resources.find(r => r.id === id);
        return <div className="attached-resource" key={id}><strong>{resource?.name ?? id}</strong><button className="link-button" onClick={() => void run(() => detachResource(character.id, id))}>{it.detach}</button></div>;
      })}
      <button className="button secondary" onClick={() => { useUi.getState().selectSystem(system.key); navigate('resources'); }}><Plus size={16} />{it.resources}</button>
    </div><p className="aside-caption">{it.savingHelp}</p></aside></div>
    {deleting && <Modal title={it.deleteCharacter} onClose={() => setDeleting(false)}><div className="modal-actions">
      <button className="button secondary" onClick={() => setDeleting(false)}>{it.cancel}</button>
      <button className="button danger" onClick={() => void run(async () => {
        await db.transaction('rw', db.characters, db.rolls, db.combats, async () => {
          if ((await db.combats.where('systemKey').equals(character.systemKey).toArray()).some(c => c.combatants.some(f => f.characterId === character.id)))
            throw new Error('Personaggio usato in un incontro: rimuovilo prima dal combattimento.');
          await db.characters.delete(character.id);
          await db.rolls.filter(r => r.characterId === character.id).delete();
        }); navigate('characters');
      })}>{it.delete}</button>
    </div></Modal>}
  </>;
}
