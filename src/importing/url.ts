/** @file Direct HTTPS file downloads; no repository traversal, credentials or proxy. */
import { prepareImport, readBounded } from './package';
import { MAX_SYSTEM_BYTES } from './system';
import { it } from '../ui/it';

/**
 * Download and preview one direct JSON/gzip-JSON system URL.
 * @remarks URL, HTTP, HTML, timeout and network/CORS errors remain distinct.
 * Query strings are omitted from stored provenance to avoid retaining tokens.
 */
export async function importFromUrl(url: string) {
  let address: URL;
  try { address = new URL(url); } catch { throw new Error(it.invalidUrl); }
  if (address.protocol !== 'https:' || address.username || address.password) throw new Error(it.invalidUrl);
  const segments = address.pathname.split('/').filter(Boolean);
  if (['github.com', 'www.github.com'].includes(address.hostname) && segments.length >= 2 &&
      (segments.length === 2 || ['blob', 'tree'].includes(segments[2]))) throw new Error(it.githubPage);
  if (/\.(rpgs|gzip|gz|zip)$/i.test(address.pathname)) throw new Error(it.invalidFile);
  const signal = AbortSignal.timeout(15000);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const response = await fetch(address, { credentials: 'omit', referrerPolicy: 'no-referrer', signal });
    try {
      if (!response.ok) throw new Error(`HTTP ${response.status}: il server non ha restituito il file.`);
      if (/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') ?? '')) throw new Error(it.remoteHtml);
      if (Number(response.headers.get('content-length')) > MAX_SYSTEM_BYTES) throw new Error('File remoto troppo grande: massimo 8 MB.');
    } catch (error) {
      try { await response.body?.cancel(); } catch { /* Preserve the response diagnostic. */ }
      throw error;
    }
    if (!response.body) throw new Error('Risposta vuota.');
    bytes = await readBounded(response.body);
  } catch (error) {
    if (signal.aborted || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))) throw new Error(it.downloadTimeout);
    if (error instanceof TypeError) throw new Error(it.downloadBlocked);
    throw error;
  }
  if (bytes.find(b => ![9, 10, 13, 32].includes(b)) === 60) throw new Error(it.remoteHtml);
  return prepareImport(bytes, address.origin + address.pathname);
}
