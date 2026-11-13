/** @file Local-first system imports with a review-before-write boundary. */
import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, FileJson, FolderInput, Globe, Plus, Upload } from 'lucide-react';
import type { StoredSystem } from '../domain/model';
import { demoOriginal } from '../demo';
import { MAX_SYSTEM_BYTES, prepareSystem } from '../importing/system';
import { artifactBytes, prepareImport } from '../importing/package';
import { importFromUrl } from '../importing/url';
import { discoverGithub, githubRepository, importGithubFile, type GithubSnapshot } from '../importing/github';
import { installSystem } from '../persistence/db';
import { it } from './it';
import { CompatibilityBadge, Modal, PageHeading, Warning, download, downloadBlob, type Run } from './shared';
import { useUi } from './store';

/** Preserve exact source text and let users review compatibility before installing. */
export function Library({ systems, run }: { systems: StoredSystem[]; run: Run }) {
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<StoredSystem | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const [repository, setRepository] = useState<GithubSnapshot | null>(null);
  const [repositoryRef, setRepositoryRef] = useState('');
  const [repositoryPath, setRepositoryPath] = useState('');
  const { navigate, selectSystem } = useUi();
  async function prepare(original: string, source: string) { setPreview(await prepareSystem(original, source)); }
  async function load(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try { await action(); } finally { busy.current = false; setLoading(false); }
  }
  async function fromUrl() {
    await load(async () => {
      if (githubRepository(url)) {
        const snapshot = await discoverGithub(url, repositoryRef);
        setRepository(snapshot); setRepositoryPath(snapshot.files[0].path);
      } else {
        setPreview(await importFromUrl(url.trim())); setShowUrl(false);
      }
    });
  }
  async function fromRepository() {
    if (!repository) return;
    await load(async () => {
      setPreview(await importGithubFile(repository, repositoryPath));
      setRepository(null); setShowUrl(false);
    });
  }
  return <>
    <PageHeading eyebrow={it.libraryEyebrow} title={it.systems} description={it.systemSubtitle}
      action={<button className="button primary" onClick={() => file.current?.click()}><Plus size={18} />{it.importSystem}</button>} />
    <input ref={file} type="file" accept=".json,.rpg,application/json,application/gzip" className="sr-only" aria-label={it.localFile} onChange={e => {
      const f = e.target.files?.[0]; e.target.value = '';
      if (f) void run(async () => {
        if (!/\.(json|rpg)$/i.test(f.name)) throw new Error(it.invalidFile);
        if (f.size > MAX_SYSTEM_BYTES) throw new Error('File troppo grande: massimo 8 MB.');
        setPreview(await prepareImport(new Uint8Array(await f.arrayBuffer()), f.name));
      });
    }} />
    <div className="library-intro">
      <div className="import-panel">
        <div className="panel-icon"><FolderInput size={24} /></div><h2>{it.importSystem}</h2><p className="muted">{it.importHelp}</p>
        <div className="button-row"><button className="button secondary" onClick={() => file.current?.click()}><Upload size={17} />{it.localFile}</button>
          <button className="button text-button" onClick={() => { setRepository(null); setShowUrl(true); }}><Globe size={16} />{it.importUrl}</button></div>
        <small className="muted">{it.jsonSafety}</small>
      </div>
      <div className="demo-panel">
        <div className="demo-art" aria-hidden="true"><svg viewBox="0 0 200 140"><path d="M10 123 68 28l30 49 24-38 68 84zM68 28l-7 52 16-10 21 7M122 39l-4 42 13-8 19 20M82 123l17-27 17 27" /></svg></div>
        <p className="eyebrow">{it.original}</p><h2>{it.demoTitle}</h2><p>{it.demoDescription}</p>
        <button className="button demo-button" onClick={() => void run(() => prepare(demoOriginal, 'SheetCore · contenuto originale MIT'))}>{it.demoAction}<ArrowRight size={17} /></button>
      </div>
    </div>
    <div className="section-title"><h2>{systems.length ? it.libraryTitle : it.noSystems}</h2><span className="muted">{systems.length} {systems.length === 1 ? it.savedVersion : it.savedVersions}</span></div>
    <div className="system-grid">
      {systems.map(s => <article className="system-card" key={s.key}>
        <div className="system-card-top"><span className="system-emblem">{s.definition.abbreviation.slice(0, 4)}</span><CompatibilityBadge system={s} /></div>
        <h3>{s.definition.name}</h3><span className="muted">v{s.definition.version} <span className="mono">{s.digest.slice(0, 6)}</span></span>
        <div className="system-counts"><span>{s.definition.character_stats.length} {it.stats}</span><span>{s.definition.character_sheet_sections.length} {it.sections}</span></div>
        <div className="card-footer"><span className="offline-label"><i />{it.stored}</span><button className="icon-button" aria-label={`${it.details} ${s.definition.name}`} onClick={() => { selectSystem(s.key); navigate('diagnostics'); }}><ArrowRight size={20} /></button></div>
        <button className="link-button" onClick={() => void run(async () => {
          const name = s.definition.id.replace(/[^\w-]/g, '_');
          if (s.artifact) downloadBlob(new Blob([artifactBytes(s.artifact.base64)], { type: 'application/gzip' }), `${name}.rpg`);
          else download(s.original, `${name}.rpg.json`);
        })}><FileJson size={15} />{s.artifact ? it.exportPackage : it.exportSystem}</button>
      </article>)}
    </div>
    <div className="footnote"><BookOpen size={18} /><div><strong>{it.versions}</strong><p>{it.versionHelp}</p></div></div>
    {showUrl && <Modal title={it.importUrl} onClose={() => { if (!busy.current) { setShowUrl(false); setRepository(null); } }}>
      {repository ? <form onSubmit={e => { e.preventDefault(); void run(fromRepository); }}>
        <p className="muted">{it.repositoryResolved}</p>
        <p className="repository-address"><strong>{repository.repository}</strong><br /><code>{repository.commit}</code></p>
        <p className="muted">{it.repositoryHelp}</p>
        <label className="field"><span>{it.repositoryFile}</span><select value={repositoryPath} disabled={loading} onChange={e => setRepositoryPath(e.target.value)}>
          {repository.files.map(file => <option key={file.path} value={file.path}>{file.path} · {file.size} B</option>)}
        </select></label>
        <div className="modal-actions"><button className="button secondary" type="button" disabled={loading} onClick={() => setRepository(null)}>{it.repositoryChange}</button>
          <button className="button primary" disabled={loading}>{loading ? it.loading : it.repositoryLoad}</button></div>
      </form> : <form onSubmit={e => { e.preventDefault(); void run(fromUrl); }}>
        <label className="field"><span>{it.url}</span><input type="text" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} disabled={loading} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repository.git" required /></label>
        <label className="field"><span>{it.repositoryRef}</span><input value={repositoryRef} maxLength={200} disabled={loading} onChange={e => setRepositoryRef(e.target.value)} placeholder={it.repositoryDefault} /></label>
        <p className="muted">{it.corsHelp}</p>
        <button className="button primary" disabled={loading}>{loading ? it.loading : it.fetch}</button>
      </form>}
    </Modal>}
    {preview && <Modal title={it.importPreview} onClose={() => setPreview(null)}>
      <h3>{preview.definition.name} <small className="muted">v{preview.definition.version}</small></h3>
      <p>{preview.definition.character_stats.length} {it.stats} · {preview.definition.character_sheet_sections.length} {it.sections} · {preview.definition.resources.length} {it.resourceTypes}</p>
      <CompatibilityBadge system={preview} />
      {preview.definition.min_app_version && <p className="muted">min_app_version: {preview.definition.min_app_version}. {it.importedVersionNotice}</p>}
      {systems.some(s => s.definition.id === preview.definition.id) && <p className="muted">{it.versionHelp}</p>}
      {preview.diagnostics.length > 0 && <Warning>{it.rulesWarning}<br />{preview.diagnostics.length} {it.issues}</Warning>}
      <div className="diagnostic-preview">{preview.diagnostics.slice(0, 12).map((d, i) => <p key={i} className={d.severity === 'error' ? 'error-text' : ''}><code>{d.path}</code><br />{d.message}</p>)}</div>
      <p className="muted"><strong>{it.provenance}:</strong> {preview.source}</p>
      <div className="modal-actions"><button className="button secondary" onClick={() => setPreview(null)}>{it.cancel}</button>
        <button className="button primary" disabled={preview.diagnostics.some(d => d.severity === 'error')} onClick={() => void run(async () => {
          await installSystem(preview); selectSystem(preview.key); setPreview(null);
        }, it.imported)}>{it.confirmImport}</button></div>
    </Modal>}
  </>;
}
