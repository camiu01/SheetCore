/**
 * @file Real browser acceptance, including service-worker offline navigation.
 * @remarks URL fixtures are intercepted locally unless LIVE_RPG_IMPORT=1 opts
 * into the pinned public raw-file check. No remote writes or account APIs.
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { demo, demoOriginal } from '../../src/demo';
import { capabilitySystem } from '../fixtures/capabilities';

async function navigate(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  const all = page.locator('.sidebar');
  await all.getByRole('button', { name: label === 'Personaggi' ? /^Personaggi \d+$/ : label, exact: true }).click();
}
async function importJson(page: Page, text: string, confirm = true) {
  await navigate(page, 'Libreria sistemi');
  await page.locator('input[type=file]').setInputFiles({ name: 'system.rpg.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByRole('dialog')).toBeVisible();
  if (confirm) {
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
}
async function create(page: Page, name: string) {
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  await expect(page.getByText('Creazione manuale', { exact: true })).toBeVisible();
  await page.getByLabel('Nome del personaggio').fill(name);
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
}
async function waitForWorker(page: Page) {
  await expect(page.locator('.save-status')).toHaveText('Solo sul tuo dispositivo');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

test('production assets, manifest and offline worker retain the deployment subpath', async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error('Production acceptance requires a baseURL');
  const path = new URL(baseURL).pathname;
  await page.goto('./');
  expect(new URL(page.url()).pathname).toBe(path);
  const response = await page.request.get(new URL('manifest.webmanifest', baseURL).href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(new URL(manifest.start_url, response.url()).pathname).toBe(path);
  expect(new URL(manifest.scope, response.url()).pathname).toBe(path);
  await waitForWorker(page);
  const worker = await page.evaluate(async () => ({
    scope: new URL((await navigator.serviceWorker.ready).scope).pathname,
    script: new URL(navigator.serviceWorker.controller!.scriptURL).pathname
  }));
  expect(worker).toEqual({ scope: path, script: `${path}sw.js` });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.connection')).toHaveText('Offline');
  await expect(page.getByRole('heading', { name: 'La prossima storia inizia qui.' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(path);
});

test('local import → character → edits → offline reload → complete backup round-trip', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await importJson(page, '\ufeff' + demoOriginal);
  await create(page, 'Ada del passo');
  await expect(page.getByTestId('stat-slancio')).toHaveText('3');
  await page.getByLabel('Modifica Vigore', { exact: true }).fill('7');
  await page.getByLabel('Modifica Vigore', { exact: true }).press('Tab');
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).fill('Il ponte a nord è sicuro.');
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).press('Tab');
  await waitForWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.connection')).toHaveText('Offline');
  await page.getByRole('button', { name: /Ada del passo/ }).click();
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await expect(page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true })).toHaveValue('Il ponte a nord è sicuro.');
  await navigate(page, 'Risorse');
  await page.getByRole('button', { name: 'Nuova risorsa locale', exact: true }).click();
  await page.getByLabel('Nome nell’archivio').fill('Mappa del passo');
  await page.getByLabel('Titolo', { exact: true }).fill('Il passo a nord');
  await page.getByLabel('Descrizione', { exact: true }).fill('Sentiero segnato sul ponte.');
  await page.getByRole('button', { name: 'Salva risorsa' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Collega', exact: true }).click();
  await navigate(page, 'Dadi');
  await page.getByLabel('Formula del tiro').fill('2d6 + 3');
  await page.getByRole('button', { name: 'Lancia i dadi', exact: true }).click();
  await expect(page.locator('.dice-result output')).toHaveText(/^\d+$/);
  await navigate(page, 'Impostazioni');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup' }).click();
  const download = await downloadEvent;
  const backup = readFileSync((await download.path())!, 'utf8');
  const data = JSON.parse(backup);
  expect(data.characters[0].values.vigore).toBe(7);
  expect(data.characters[0].resourceIds).toHaveLength(1);
  expect(data.resources).toHaveLength(1); expect(data.rolls).toHaveLength(1);
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: /Ada del passo/ }).click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'La prossima storia inizia qui.' })).toBeVisible();
  await navigate(page, 'Impostazioni');
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Sostituisci archivio' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /Ada del passo/ }).click();
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await expect(page.getByText('Mappa del passo', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true })).toHaveValue('Il ponte a nord è sicuro.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('typed photos, lists, resource references and encounter turns survive offline backup restore', async ({ page, context }) => {
  await page.goto('./'); await importJson(page, JSON.stringify(capabilitySystem));
  await create(page, 'Mara');
  await page.locator('.base-editor > summary').click();
  await page.getByRole('button', { name: 'Aggiungi valore', exact: true }).click();
  await page.getByLabel('words 1', { exact: true }).fill('Nord');
  await page.getByLabel('words 1', { exact: true }).press('Tab');
  await page.getByLabel('Scegli foto · portrait', { exact: true }).setInputFiles({
    name: 'truncated.png', mimeType: 'image/png', buffer: readFileSync(resolve('public/icon-192.png')).subarray(0, 33)
  });
  await expect(page.getByRole('alert')).toHaveText('Foto PNG/JPEG non decodificabile.');
  await page.getByLabel('Scegli foto · portrait', { exact: true }).setInputFiles(resolve('public/icon-192.png'));
  await expect(page.getByRole('img', { name: 'portrait', exact: true })).toHaveAttribute('src', /^data:image\/png;base64,/);
  await navigate(page, 'Risorse');
  await page.getByRole('button', { name: 'Nuova risorsa locale', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo di risorsa', exact: true }).selectOption('scout');
  await page.getByLabel('Nome nell’archivio', { exact: true }).fill('Guardia Nord');
  await page.getByRole('button', { name: 'Salva risorsa', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: /Mara/ }).click();
  await page.locator('.base-editor > summary').click();
  await page.getByRole('combobox', { name: 'origin', exact: true }).selectOption({ label: 'Guardia Nord · scout' });
  await page.getByRole('checkbox', { name: 'Guardia Nord · scout', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Guardia Nord · scout', exact: true })).toBeChecked();
  await navigate(page, 'Combattimento');
  await page.getByLabel('Nome dell’incontro', { exact: true }).fill('Guado');
  await page.getByRole('button', { name: 'Nuovo incontro', exact: true }).click();
  await page.getByRole('button', { name: 'Aggiungi combattente', exact: true }).click();
  await expect(page.locator('.combatant-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Aggiungi combattente', exact: true }).click();
  await expect(page.locator('.combatant-card')).toHaveCount(2);
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(0).fill('15');
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(0).press('Tab');
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(1).fill('10');
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(1).press('Tab');
  await page.getByRole('button', { name: 'Avvia / riprendi', exact: true }).click();
  await expect(page.locator('.combatant-current')).toHaveCount(1);
  await page.getByRole('button', { name: 'Prossimo turno', exact: true }).click();
  await page.getByRole('button', { name: 'Prossimo turno', exact: true }).click();
  await expect(page.getByText(/Round 2 · Passaggio 1/)).toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await navigate(page, 'Combattimento');
  await expect(page.getByText(/Round 2 · Passaggio 1/)).toBeVisible();
  await navigate(page, 'Impostazioni');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const bytes = readFileSync((await (await event).path())!);
  const backup = JSON.parse(bytes.toString('utf8'));
  expect(backup.version).toBe(3); expect(backup.combats[0].round).toBe(2);
  expect(backup.characters[0].values.words).toEqual(['Nord']);
  expect(backup.characters[0].values.companions).toEqual([backup.characters[0].values.origin]);
  expect(backup.characters[0].values.portrait.base64).toBeTruthy();
  await page.locator('input[type=file]').setInputFiles({ name: 'encounter-backup.json', mimeType: 'application/json', buffer: bytes });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, 'Combattimento');
  await expect(page.getByText(/Round 2 · Passaggio 1/)).toBeVisible();
});

test('rejects malformed files and shows unknown components without running scripts', async ({ page }) => {
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.getByRole('alert')).toContainText('JSON malformato');
  await importJson(page, JSON.stringify({ ...demo, character_sheet_sections: [
    ...demo.character_sheet_sections,
    { id: 'unknown', view: { id: 'unknown_view', type: 'futureWidget', code: 'window.compromised=true' } }
  ] }));
  await create(page, 'Test sicuro');
  await expect(page.getByText('Non supportato: futureWidget', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, 'compromised'))).toBe(false);
});

test('URL imports report HTTP and CORS errors and import a permitted JSON response', async ({ page }) => {
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.route('https://fixtures.sheetcore.test/missing.json', route => route.fulfill({ status: 404, body: 'Not found', headers: { 'access-control-allow-origin': '*' } }));
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByLabel('URL diretto del sistema JSON o .rpg').fill('https://fixtures.sheetcore.test/missing.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 404');
  await page.route('https://fixtures.sheetcore.test/cors.json', route => route.abort('failed'));
  await page.getByLabel('URL diretto del sistema JSON o .rpg').fill('https://fixtures.sheetcore.test/cors.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('CORS');
  await page.route('https://fixtures.sheetcore.test/system.json', route => route.fulfill({ status: 200, body: demoOriginal, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
  await page.getByLabel('URL diretto del sistema JSON o .rpg').fill('https://fixtures.sheetcore.test/system.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('heading', { name: 'Sentieri', exact: true })).toBeVisible();
});

test('URL import identifies the reported GitHub repository instead of blaming CORS', async ({ page }) => {
  const repository = 'https://github.com/derpsyhome/3rd-party-books-for-5e';
  let requests = 0;
  await page.route(repository, async route => { requests++; await route.abort('failed'); });
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByLabel('URL diretto del sistema JSON o .rpg').fill(repository);
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('pagina GitHub');
  await expect(page.getByRole('alert')).toContainText('system.rpg gzip-JSON');
  expect(requests).toBe(0);
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).not.toBeVisible();
});

test('theme, keyboard focus, mobile layout and multiple characters', async ({ page }, testInfo) => {
  await page.goto('./'); await importJson(page, demoOriginal);
  for (const name of ['Mira di Rocca', 'Lupo delle Felci', 'Neri']) await create(page, name);
  await navigate(page, 'Impostazioni');
  await page.getByRole('button', { name: 'Scuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await navigate(page, 'Impostazioni');
  await page.getByRole('button', { name: 'Chiaro', exact: true }).click();
  await navigate(page, 'Personaggi');
  await expect(page.locator('.character-card')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  await page.screenshot({ path: testInfo.outputPath('characters.png'), fullPage: true });
});

test('pinned real external subset survives browser editing and offline reopening', async ({ page, context }) => {
  test.skip(!existsSync(resolve('.reference/5e-slice.json')), 'Run npm run test:external to prepare the licensed local-only subset.');
  await page.goto('./');
  await importJson(page, readFileSync(resolve('.reference/5e-slice.json'), 'utf8'));
  await create(page, 'External integration');
  await expect(page.getByTestId('stat-strength_modifier')).toHaveText('-1');
  await page.getByLabel('Modifica Strength', { exact: true }).fill('15');
  await page.getByLabel('Modifica Strength', { exact: true }).press('Tab');
  await expect(page.getByTestId('stat-strength_modifier')).toHaveText('2');
  await expect(page.getByText('Non supportato: on_tap_event').first()).toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /External integration/ }).click();
  await expect(page.getByTestId('stat-strength_modifier')).toHaveText('2');
});

test('provided Archer compiled system JSON imports with explicit partial support', async ({ page, context }) => {
  const path = resolve('.reference/archer-system.json');
  test.skip(!existsSync(path), 'Run node scripts/inspect-archer.mjs after cloning the provided repo.');
  await page.goto('./');
  await importJson(page, readFileSync(path, 'utf8'), false);
  await expect(page.getByRole('dialog').getByText('Supporto parziale', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await create(page, 'Provided repository');
  const abilities = page.locator('.sheet-section').filter({ hasText: 'Ability Modifiers' });
  await expect(abilities.getByTestId('stat-strength_modifier')).toHaveText('-1');
  await abilities.getByLabel('Modifica Strength', { exact: true }).fill('15');
  await abilities.getByLabel('Modifica Strength', { exact: true }).press('Tab');
  await expect(abilities.getByTestId('stat-strength_modifier')).toHaveText('2');
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /Provided repository/ }).click();
  await expect(abilities.getByTestId('stat-strength_modifier')).toHaveText('2');
});

for (const { label, file, stat, input, before, after, value } of [
  { label: 'Sentieri', file: '', stat: 'slancio', input: 'Vigore', before: '3', after: '8', value: '7' },
  { label: 'Archer', file: '.reference/archer-system.rpg', stat: 'strength_modifier', input: 'Strength', before: '-1', after: '2', value: '15' },
  { label: 'derpsy', file: '.reference/derpsy-system.rpg', stat: 'strength_modifier', input: 'Strength', before: '-1', after: '2', value: '15' }
]) {
  test(`original ${label} .rpg survives file import, offline, exact export and backup restore`, async ({ page, context }) => {
    test.skip(Boolean(file) && !existsSync(resolve(file)), 'Prepare the local-only pinned source artifact.');
    const original = file ? readFileSync(resolve(file)) : gzipSync(demoOriginal);
    await page.goto('./'); await navigate(page, 'Libreria sistemi');
    await page.locator('input[type=file]').setInputFiles({ name: 'system.rpg', mimeType: 'application/gzip', buffer: original });
    if (file) await expect(page.getByRole('dialog').getByText('Supporto parziale', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await create(page, 'Original package');
    const sheet = file ? page.locator('.sheet-section').filter({ hasText: 'Ability Modifiers' }) : page.locator('main');
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(before);
    await sheet.getByLabel(`Modifica ${input}`, { exact: true }).fill(value);
    await sheet.getByLabel(`Modifica ${input}`, { exact: true }).press('Tab');
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(after);
    await waitForWorker(page); await context.setOffline(true); await page.reload();
    await page.getByRole('button', { name: /Original package/ }).click();
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(after);
    await navigate(page, 'Libreria sistemi');
    let event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta .rpg originale', exact: true }).click();
    let exported = await event;
    expect(exported.suggestedFilename()).toMatch(/\.rpg$/);
    expect(readFileSync((await exported.path())!)).toEqual(original);
    await navigate(page, 'Impostazioni');
    event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
    const backup = readFileSync((await (await event).path())!, 'utf8');
    const parsed = JSON.parse(backup);
    expect(parsed.version).toBe(3);
    expect(Buffer.from(parsed.systems[0].artifact.base64, 'base64')).toEqual(original);
    await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Sostituisci archivio' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: /Original package/ }).click();
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(after);
    await navigate(page, 'Libreria sistemi');
    event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta .rpg originale', exact: true }).click();
    exported = await event;
    expect(readFileSync((await exported.path())!)).toEqual(original);
  });
}

test('direct raw .rpg imports the supplied repository system', async ({ page }) => {
  const path = resolve('.reference/derpsy-system.rpg');
  test.skip(!existsSync(path), 'Prepare the pinned derpsy system artifact.');
  const url = 'https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg';
  const bytes = readFileSync(path);
  if (process.env.LIVE_RPG_IMPORT !== '1') {
    await page.route(url, route => route.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } }));
  }
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByLabel('URL diretto del sistema JSON o .rpg').fill(url);
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Supporto parziale', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta .rpg originale', exact: true }).click();
  expect(readFileSync((await (await event).path())!)).toEqual(bytes);
});

test('bad .rpg envelopes and gzip resource indexes fail without installation', async ({ page }) => {
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.rpg', mimeType: 'application/octet-stream', buffer: Buffer.from([80, 75, 3, 4]) });
  await expect(page.getByRole('alert')).toContainText('Formato .rpg non riconosciuto');
  await page.locator('input[type=file]').setInputFiles({ name: 'systems.rpg', mimeType: 'application/gzip', buffer: gzipSync('{"systems":[]}') });
  await expect(page.getByRole('alert')).toContainText('non contiene un sistema JSON monolitico');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(0);
});

test('.rpg expanded byte ceiling rejects 8 MiB plus one and accepts exactly 8 MiB', async ({ page }) => {
  const limit = 8 * 1024 * 1024;
  const boundary = demoOriginal + ' '.repeat(limit - Buffer.byteLength(demoOriginal));
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.locator('input[type=file]').setInputFiles({ name: 'bomb.rpg', mimeType: 'application/gzip', buffer: gzipSync(boundary + ' ') });
  await expect(page.getByRole('alert')).toContainText('troppo grande');
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({ name: 'boundary.rpg', mimeType: 'application/gzip', buffer: gzipSync(boundary) });
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(1);
});
