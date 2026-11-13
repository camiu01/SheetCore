/**
 * Roll the documented `xdy +/- n` expression subset.
 * @param expression - One bounded expression; no arbitrary scripting.
 * @param allowedFaces - Restrict to imported dice when provided.
 * @param random - Injectable face generator for deterministic tests.
 * @throws On invalid syntax, count/faces limits, or out-of-range generated values.
 * @see https://docs.rpg-companion.app/System/Rollable
 */
export function rollDice(expression: string, allowedFaces?: number[], random = randomFace) {
  const match = /^(\d{1,3})d(\d{1,7})(?:\s*([+-])\s*(\d{1,6}))?$/i.exec(expression.trim());
  if (!match) throw new Error('Usa una formula come 2d6 + 3 oppure 1d20.');
  const count = Number(match[1]), faces = Number(match[2]);
  if (count < 1 || count > 100 || faces < 2 || faces > 1000000) throw new Error('Limiti: 1–100 dadi, 2–1.000.000 facce.');
  if (allowedFaces && !allowedFaces.includes(faces)) throw new Error('Dado non definito da questo sistema.');
  const modifier = Number(match[4] ?? 0) * (match[3] === '-' ? -1 : 1);
  const results = Array.from({ length: count }, () => random(faces));
  if (results.some(v => !Number.isInteger(v) || v < 1 || v > faces)) throw new Error('Generatore casuale non valido');
  return { results, total: results.reduce((a, b) => a + b, modifier) };
}
/** Rejection sampling avoids modulo bias in cryptographic random integers. */
function randomFace(faces: number) {
  const buffer = new Uint32Array(1);
  const ceiling = Math.floor(4294967296 / faces) * faces;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return buffer[0] % faces + 1;
}
