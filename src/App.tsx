/** @file Application shell. Persistent domain data is read directly from Dexie. */
import { Component, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BookOpen, Check, ChevronsUpDown, CloudOff, Dices, Download, FolderOpen, Hexagon, LayoutGrid, Menu, Settings2, ShieldCheck, X } from 'lucide-react';
import { db, defaultPreferences } from './persistence/db';
import { Characters, CharacterSheet } from './ui/Characters';
import { Library } from './ui/Library';
import { Diagnostics, DicePage, Resources, Settings } from './ui/Tools';
import { CombatTracker } from './ui/CombatTracker';
import { diagnose } from './importing/system';
import './ui/fields.css';
import { useUi, type Page } from './ui/store';
import { it } from './ui/it';
import type { Run } from './ui/shared';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const pages = [
  { id: 'characters', label: it.characters, icon: LayoutGrid },
  { id: 'systems', label: it.systems, icon: BookOpen },
  { id: 'resources', label: it.resources, icon: FolderOpen },
  { id: 'dice', label: it.dice, icon: Dices },
  { id: 'combat', label: it.combat, icon: ShieldCheck }
] as const;

/** Render offline status, navigation, update prompts, and the selected local screen. */
export default function App() {
  // Recompute capabilities after an app update without rewriting source imports.
  const systems = useLiveQuery(async () => (await db.systems.toArray()).map(s => ({ ...s, diagnostics: diagnose(s.definition) })), []) ?? [];
  const characters = useLiveQuery(() => db.characters.orderBy('updatedAt').reverse().toArray(), []) ?? [];
  const preferences = useLiveQuery(() => db.preferences.get('app'), []) ?? defaultPreferences;
  const { page, characterId, systemKey, navigate } = useUi();
  const [menu, setMenu] = useState(false);
  const [pending, setPending] = useState(0);
  const [notification, setNotification] = useState<{ text: string; error: boolean } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW({
    onRegisterError(error) { setNotification({ text: `Service worker: ${String(error)}`, error: true }); }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.colorScheme = preferences.theme;
  }, [preferences.theme]);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const install = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
    window.addEventListener('beforeinstallprompt', install);
    return () => {
      window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', install);
    };
  }, []);
  const run: Run = async (work, success) => {
    setPending(n => n + 1);
    try { await work(); if (success) setNotification({ text: success, error: false }); }
    catch (error) { setNotification({ text: error instanceof Error ? error.message : String(error), error: true }); }
    finally { setPending(n => n - 1); }
  };
  const selectedSystem = systems.find(s => s.key === systemKey) ?? systems[0];
  const character = characters.find(c => c.id === characterId);
  const characterSystem = systems.find(s => s.key === character?.systemKey);
  const go = (p: Page) => { navigate(p); setMenu(false); };
  return <div className="app-shell">
    <a className="skip-link" href="#main">{it.skipToContent}</a>
    {menu && <button className="nav-backdrop" aria-label={it.close} onClick={() => setMenu(false)} />}
    <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => go('characters')} aria-label={`${it.brand} · ${it.characters}`}><span className="brand-symbol"><Hexagon size={27} /><span /></span><strong>{it.brand}<span>{it.tagline}</span></strong></button>
      <div className="workspace-label"><span className="workspace-avatar">S</span><div>{it.mySpace}<small>{it.personalArchive}</small></div><ChevronsUpDown size={15} /></div>
      <div className="nav-section-label">{it.atTheTable}</div>
      <nav aria-label={it.mainNavigation}>{pages.map(p => <button key={p.id} onClick={() => go(p.id)} className={`nav-item ${page === p.id ? 'active' : ''}`} aria-current={page === p.id ? 'page' : undefined}><p.icon size={19} />{p.label}{p.id === 'characters' && <span className="nav-count">{characters.length}</span>}</button>)}</nav>
      <div className="nav-section-label second-label">{it.workspace}</div>
      <nav aria-label={it.workspace}>{[
        { id: 'diagnostics', label: it.diagnostics, icon: ShieldCheck },
        { id: 'settings', label: it.settings, icon: Settings2 }
      ].map(p => <button key={p.id} onClick={() => go(p.id as Page)} className={`nav-item ${page === p.id ? 'active' : ''}`} aria-current={page === p.id ? 'page' : undefined}><p.icon size={19} />{p.label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="local-note"><span className="local-icon"><CloudOff size={19} /></span><strong>{it.privacyTitle}</strong><p>{it.sidebarPrivacy}</p></div><span className="version-label">SheetCore <span>v0.1.0 · OPEN SOURCE</span></span></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label={it.mainNavigation} aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={21} /></button><span>{it.mySpace}</span><span className="breadcrumb-slash">/</span><strong>{it[page]}</strong></div>
      <div className="topbar-right"><span className={`connection ${online ? '' : 'is-offline'}`}><i />{online ? it.online : it.offline}</span><span className="save-status" role="status">{pending ? it.saving : <><Check size={14} />{it.local}</>}</span>{installEvent && <button className="icon-button" aria-label={it.install} onClick={() => void run(async () => { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); })}><Download size={18} /></button>}<span className="profile-dot">S</span></div></header>
      <main id="main" tabIndex={-1}>
        {notification && <div role={notification.error ? 'alert' : 'status'} className={`notification ${notification.error ? 'notification-error' : ''}`}><div><strong>{notification.error ? it.error : it.brand}</strong><p>{notification.text}</p></div><button className="icon-button" aria-label={it.close} onClick={() => setNotification(null)}><X size={18} /></button></div>}
        {needRefresh && <div className="notice update-notice"><p>{it.update}</p><button className="button secondary" onClick={() => void run(() => updateServiceWorker(true))}>{it.updateAction}</button></div>}
        {offlineReady && <div className="notice notice-success"><Check size={18} /><p>{it.offlineReady}</p><button className="icon-button" aria-label={it.close} onClick={() => setOfflineReady(false)}><X size={16} /></button></div>}
        {page === 'characters' && (character && characterSystem ? <CharacterSheet character={character} system={characterSystem} run={run} /> : <Characters systems={systems} characters={characters} run={run} />)}
        {page === 'systems' && <Library systems={systems} run={run} />}
        {page === 'resources' && <Resources systems={systems} system={selectedSystem} characters={characters} run={run} />}
        {page === 'dice' && <DicePage systems={systems} system={selectedSystem} preferences={preferences} run={run} />}
        {page === 'combat' && <CombatTracker systems={systems} system={selectedSystem} characters={characters} run={run} />}
        {page === 'diagnostics' && <Diagnostics systems={systems} system={selectedSystem} />}
        {page === 'settings' && <Settings preferences={preferences} run={run} />}
        <footer className="main-footer"><span>{it.brand} <span className="footer-separator">/</span> {it.footerTagline}</span><span>LOCAL-FIRST · OPEN SOURCE</span></footer>
      </main>
    </div>
  </div>;
}
/** Keep render/storage failures actionable instead of showing a blank screen. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (this.state.error) return <main className="fatal-error"><h1>{it.error}</h1><p>{this.state.error}</p><p>{it.storageError}</p><button className="button primary" onClick={() => window.location.reload()}>{it.retry}</button></main>;
    return this.props.children;
  }
}
