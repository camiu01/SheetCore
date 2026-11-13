/** @file Local-only photo editing and preview, with explicit remote-image fallback. */
import { useState } from 'react';
import { isPhoto, MAX_PHOTO_BYTES, photoFromBytes, photoImageUrl, type Photo } from '../domain/photo';
import { it } from './it';
import { Modal } from './shared';

/** Render a bounded local photo; remote source URLs remain inert. */
export function PhotoInput({ value, label, onSave, preview = false, size = 'medium' }: {
  value: unknown; label: string; onSave?: (value: Photo) => void; preview?: boolean; size?: string;
}) {
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const photo = isPhoto(value) ? value : { url: null, base64: null };
  const image = photoImageUrl(photo);
  const picture = image ? <img src={image} alt={label} className={`local-photo photo-${size}`} /> : <span className="photo-placeholder">{label.slice(0, 1)}</span>;
  return <div className="field photo-field">
    <span>{label}</span>
    {image && preview ? <button type="button" className="photo-preview-button" aria-label={`${it.details} · ${label}`} onClick={() => setOpen(true)}>{picture}</button> : picture}
    {photo.url && !image && <small className="muted">{it.remotePhoto}</small>}
    {onSave && <><label className="field"><span>{it.choosePhoto}</span><input aria-label={`${it.choosePhoto} · ${label}`} type="file" accept="image/png,image/jpeg" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      void (async () => {
        try {
          if (file.size > MAX_PHOTO_BYTES) throw new Error(it.photoLimit);
          const next = photoFromBytes(new Uint8Array(await file.arrayBuffer()));
          try { const decoded = await createImageBitmap(file); decoded.close(); }
          catch { throw new Error(it.invalidPhoto); }
          setError(''); onSave(next);
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      })();
    }} /></label>
    {(photo.base64 || photo.url) && <button type="button" className="link-button" onClick={() => onSave({ url: null, base64: null })}>{it.removePhoto}</button>}</>}
    {error && <small role="alert" className="error-text">{error}</small>}
    {open && image && <Modal title={label} onClose={() => setOpen(false)}><img className="photo-expanded" src={image} alt={label} /></Modal>}
  </div>;
}
