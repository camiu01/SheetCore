/** @file Bounded local raster photos. No SVG, scripts, or remote image fetches. */
export const MAX_PHOTO_BYTES = 1024 * 1024;
export interface Photo { url: string | null; base64: string | null }
/** Inspect raster dimensions before allowing the browser to decode image pixels. */
function mime(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error('Foto troppo grande: massimo 1 MB.');
  let width = 0, height = 0, type = '';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
    && view.getUint32(12) === 0x49484452) {
    width = view.getUint32(16); height = view.getUint32(20); type = 'image/png';
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); type = 'image/jpeg'; break;
      }
      offset += length;
    }
  }
  if (!type || width < 1 || height < 1 || width > 4096 || height > 4096)
    throw new Error('Usa una foto PNG/JPEG valida, massimo 4096 × 4096 pixel.');
  return type;
}
/** Store exact local image bytes in the observed `{url, base64}` photo envelope. */
export function photoFromBytes(bytes: Uint8Array): Photo {
  mime(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return { url: null, base64: btoa(binary) };
}
/** Produce only an inspected data URL; a source URL never triggers a request. */
export function photoImageUrl(value: Photo): string | null {
  if (value.base64 === null) return null;
  if (value.base64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64))
    throw new Error('Foto Base64 non valida.');
  const binary = atob(value.base64);
  if (btoa(binary) !== value.base64) throw new Error('Foto Base64 non canonica.');
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return `data:${mime(bytes)};base64,${value.base64}`;
}
/** Validate persisted photos without loading images or contacting a remote host. */
export function isPhoto(value: unknown): value is Photo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !['url', 'base64'].includes(k)) || !Object.hasOwn(p, 'url') || !Object.hasOwn(p, 'base64')
    || !(p.url === null || (typeof p.url === 'string' && p.url.length <= 2048))
    || !(p.base64 === null || typeof p.base64 === 'string')) return false;
  try { photoImageUrl(value as Photo); return true; } catch { return false; }
}
