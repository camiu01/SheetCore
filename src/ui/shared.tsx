/** @file Accessible shared UI and bounded browser file/download utilities. */
import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, AlertTriangle } from 'lucide-react';
import type { StoredSystem } from '../domain/model';
import { decodeUtf8 } from '../importing/system';
import { it } from './it';

export type Run = (work: () => Promise<unknown>, success?: string) => Promise<void>;
/** Native modal dialog supplies focus trapping, Escape handling, and focus return. */
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-title">
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label={it.close} onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</header>;
}
export function SystemSelect({ systems, value, onChange }: { systems: StoredSystem[]; value: string; onChange: (key: string) => void }) {
  return <label className="field system-select"><span>{it.chooseSystem}</span><select value={value} onChange={e => onChange(e.target.value)}>
    {!systems.length && <option value="">{it.choose}</option>}
    {systems.map(s => <option key={s.key} value={s.key}>{s.definition.name} · v{s.definition.version} · {s.digest.slice(0, 6)}</option>)}
  </select></label>;
}
export function CompatibilityBadge({ system }: { system: StoredSystem }) {
  return <span className={`badge ${system.diagnostics.length ? 'badge-warning' : 'badge-success'}`}>{system.diagnostics.length ? it.partial : it.supported}</span>;
}
export function Warning({ children }: { children: ReactNode }) {
  return <div className="notice notice-warning"><AlertTriangle size={18} /><div>{children}</div></div>;
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><div className="empty-mark"><ArrowUpRight size={28} /></div><h2>{title}</h2><p className="muted">{children}</p>{action}</div>;
}
/** Download local JSON without sending any content to a remote service. */
export function download(text: string, name: string) {
  downloadBlob(new Blob([text], { type: 'application/json' }), name);
}
/** Download an original binary file without recompressing or reserializing it. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Check the browser's file byte count before materializing its text. */
export async function readFile(file: File, maxBytes: number) {
  if (file.size > maxBytes) throw new Error(`File troppo grande: massimo ${maxBytes / 1024 / 1024} MB.`);
  return decodeUtf8(await file.arrayBuffer());
}
