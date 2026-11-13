/**
 * @file Verified gzip-JSON system variant only, not a general RPG package decoder.
 * @remarks Compressed and expanded bytes are independently bounded. Archives,
 * distribution indexes and resource packs are never interpreted as systems.
 */
import type { StoredSystem } from '../domain/model';
import { decodeUtf8, MAX_SYSTEM_BYTES, prepareSystem } from './system';

/** Read a byte stream without trusting Content-Length or a gzip size trailer. */
export async function readBounded(stream: ReadableStream<Uint8Array>, limit = MAX_SYSTEM_BYTES) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error(`File troppo grande: massimo ${limit / 1024 / 1024} MB, anche dopo decompressione.`);
      chunks.push(value);
    }
  } finally {
    // Cancellation must not mask the original read/checksum/limit failure.
    try { await reader.cancel(); } catch { /* The failed stream is already closed. */ }
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/** Encode original bytes in bounded chunks, avoiding spread-argument stack overflow. */
function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return btoa(chunks.join(''));
}

/** Decode a canonical, size-bounded stored original for export or backup validation. */
export function artifactBytes(base64: string): Uint8Array<ArrayBuffer> {
  if (base64.length > Math.ceil(MAX_SYSTEM_BYTES / 3) * 4) throw new Error('Originale .rpg troppo grande.');
  let raw: string;
  try { raw = atob(base64); } catch { throw new Error('Originale .rpg Base64 non valido.'); }
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  if (bytes.length > MAX_SYSTEM_BYTES || encodeBase64(bytes) !== base64) throw new Error('Originale .rpg Base64 non valido.');
  return bytes;
}

/**
 * Preview JSON or the observed gzip-JSON `.rpg` system without writing data.
 * @throws On unknown package envelopes, corruption, expansion limits or invalid JSON.
 * @remarks For gzip imports, the version identity hashes exact compressed bytes.
 * The decoded original JSON is retained separately for inspection, not as a
 * substitute for the uploaded file. Existing JSON import identities are unchanged.
 */
export async function prepareImport(inputBytes: Uint8Array, source: string): Promise<StoredSystem> {
  if (inputBytes.length > MAX_SYSTEM_BYTES) throw new Error('File troppo grande: massimo 8 MB.');
  // Own a snapshot so caller mutation cannot split the hash from the retained file.
  const bytes = Uint8Array.from(inputBytes);
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzip) {
    if (/\.rpg$/i.test(source)) throw new Error('Formato .rpg non riconosciuto: supportato soltanto un sistema JSON compresso gzip.');
    return prepareSystem(decodeUtf8(bytes), source);
  }
  if (typeof DecompressionStream === 'undefined') throw new Error('Questo browser non supporta gzip. Aggiorna il browser oppure importa il sistema JSON.');
  const input = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  let expanded: Uint8Array<ArrayBuffer>;
  try { expanded = await readBounded(input.pipeThrough(new DecompressionStream('gzip'))); }
  catch (error) {
    if (error instanceof Error && error.message.includes('troppo grande')) throw error;
    throw new Error('Pacchetto gzip danneggiato o incompleto.');
  }
  let prepared: StoredSystem;
  try { prepared = await prepareSystem(decodeUtf8(expanded), source); }
  catch (error) { throw new Error(`Il pacchetto non contiene un sistema JSON monolitico compatibile. Gli indici e gli archivi di risorse non sono supportati. ${error instanceof Error ? error.message : String(error)}`); }
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return { ...prepared, digest, key: `${prepared.definition.id}@${prepared.definition.version}:${digest}`, artifact: { format: 'gzip-json', base64: encodeBase64(bytes) } };
}
