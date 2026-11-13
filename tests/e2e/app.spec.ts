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
import { capabilitySystem, constant, list, stat } from '../fixtures/capabilities';
import { viewSystem } from '../fixtures/views';

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

test('reported original HP, AC and description recover with manual class and race resources', async ({ page, context }) => {
  const file = resolve('.reference/reported-system.rpg');
  test.skip(!existsSync(file), 'Local-only user-provided HP reproduction fixture is absent');
  await page.goto('./');
  await navigate(page, 'Libreria sistemi');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await create(page, 'HP manuale');
  await expect(page.locator('[data-view-error]').filter({ hasText: 'max_hp: classes_hp_mods: max richiede una lista non vuota' }).first()).toBeVisible();
  await expect(page.locator('[data-view-error]').filter({ hasText: 'armor_class: classes_ac: max richiede una lista non vuota' })).toBeVisible();
  await expect(page.locator('[data-view-error]').filter({ hasText: 'Statistica mancante nel percorso: race.name' })).toBeVisible();
  await expect(page.getByText('Statistica mancante: $edit_mode', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Non supportato: menuButton', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Non supportato: bottom_left_button_event', { exact: true })).toBeVisible();
  await expect(page.getByText(/Non supportato: .*bottom_right_button_event/)).toHaveCount(0);
  await page.locator('.source-avatar-section').getByRole('button', { name: 'Menu della sorgente', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Long rest', exact: true }).click();
  await expect(page.getByText(/Evento importato non eseguito da PolySheet.*trigger_long_rest/)).toBeVisible();
  await navigate(page, 'Risorse');
  for (const [definitionId, archiveName] of [['class', 'Classe manuale'], ['class_details', 'Dettagli classe manuale'], ['race', 'Razza manuale']]) {
    await page.getByRole('button', { name: 'Nuova risorsa locale', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tipo di risorsa').selectOption(definitionId);
    await dialog.getByRole('button', { name: 'Apri editor manuale dei valori base', exact: true }).click();
    await dialog.getByLabel('Nome nell’archivio').fill(archiveName);
    if (definitionId !== 'class_details') {
      await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(archiveName);
      await dialog.getByRole('textbox', { name: 'Name', exact: true }).press('Tab');
    } else {
      await dialog.getByRole('combobox', { name: 'Class', exact: true }).selectOption({ label: 'Classe manuale · class' });
      await dialog.getByRole('spinbutton', { name: 'Class level', exact: true }).fill('2');
      await dialog.getByRole('spinbutton', { name: 'Class level', exact: true }).press('Tab');
    }
    await dialog.getByRole('button', { name: 'Salva risorsa', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { name: archiveName, exact: true })).toBeVisible();
  }
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: /HP manuale/ }).click();
  const editor = page.locator('details.base-editor').filter({ has: page.locator('summary', { hasText: 'Valori base · modifica manuale' }) });
  await editor.locator('summary').click();
  const assignedClass = editor.getByRole('group', { name: 'Classes', exact: true })
    .getByRole('checkbox', { name: 'Dettagli classe manuale · class_details', exact: true });
  await assignedClass.click();
  await expect(assignedClass).toBeChecked();
  const assignedRace = editor.getByRole('combobox', { name: 'Race', exact: true });
  await assignedRace.selectOption({ label: 'Razza manuale · race' });
  await expect(assignedRace).not.toHaveValue('');
  await editor.getByRole('spinbutton', { name: 'Dexterity', exact: true }).fill('14');
  await editor.getByRole('spinbutton', { name: 'Dexterity', exact: true }).press('Tab');
  await editor.getByRole('spinbutton', { name: 'Constitution', exact: true }).fill('14');
  await editor.getByRole('spinbutton', { name: 'Constitution', exact: true }).press('Tab');
  await editor.getByRole('spinbutton', { name: 'Base HP', exact: true }).fill('10');
  await editor.getByRole('spinbutton', { name: 'Base HP', exact: true }).press('Tab');
  await expect(page.getByText('/ 14 HP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-armor_class')).toHaveText('12');
  await expect(page.getByText('Razza manuale Classe manuale 2', { exact: true })).toBeVisible();
  await expect(page.locator('[data-view-error]').filter({ hasText: /armor_class:|race.name/ })).toHaveCount(0);
  await expect(page.locator('[data-view-error]').filter({ hasText: 'max_hp: classes_hp_mods:' })).toHaveCount(0);
  await waitForWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /HP manuale/ }).click();
  await expect(page.getByText('/ 14 HP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-armor_class')).toHaveText('12');
  await expect(page.getByText('Razza manuale Classe manuale 2', { exact: true })).toBeVisible();
  await navigate(page, 'Impostazioni');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const backup = readFileSync((await (await download).path())!, 'utf8');
  const data = JSON.parse(backup);
  expect(data.resources).toHaveLength(3);
  expect(data.characters[0].values.classes).toHaveLength(1);
  expect(Buffer.from(data.systems[0].artifact.base64, 'base64')).toEqual(readFileSync(file));
  await page.locator('input[type=file]').setInputFiles({ name: 'manual-hp.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /HP manuale/ }).click();
  await expect(page.getByText('/ 14 HP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-armor_class')).toHaveText('12');
  await expect(page.getByText('Razza manuale Classe manuale 2', { exact: true })).toBeVisible();
});

test('avatar corner menu stays inside the viewport and accepts pointer selection', async ({ page }) => {
  const source = { ...demo,
    enumerated_types: [{ id: 'local-menu', name: 'Menu locale', types: [{ id: 'rest', name: 'Riposo locale' }] }],
    character_sheet_sections: [{ id: 'portrait', view: { id: 'portrait-view', type: 'avatarSection',
      center_content: [], bottom_right_stack: [{ id: 'corner-menu', type: 'menuButton', options: 'local-menu' }]
    } }]
  };
  await page.goto('./');
  await importJson(page, JSON.stringify(source));
  await create(page, 'Menu locale');
  await page.getByRole('button', { name: 'Menu della sorgente', exact: true }).click();
  const menu = page.getByRole('menu');
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await page.getByRole('menuitem', { name: 'Riposo locale', exact: true }).click();
  await expect(menu).not.toBeVisible();
  await expect(page.getByText(/Evento importato non eseguito da PolySheet.*rest/)).toBeVisible();
});

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

test('collection formulas recalculate through real inputs and offline reopening', async ({ page, context }) => {
  const yesNo = (condition: unknown) => ({ type: 'when', clauses: [
    { condition, components: constant('si') }, { condition: constant(true), components: constant('no') }
  ] });
  const source = { ...demo, character_sheet_sections: [...demo.character_sheet_sections, {
    id: 'collection-check', view: { id: 'collection-result', type: 'text', text: {
      type: 'concat', components: list(
        { type: 'joinToString', separator: ',', components: { type: 'sortBy', order: 'asc',
          components: { type: 'flatMap', components: list(constant(3), constant(1)), mapper: list(stat('$mapValue')) },
          sort_by_selector: stat('$sortByValue') } },
        constant('|'), { type: 'findFirst', components: list(constant(0), constant(2)),
          filter: { type: 'greaterThan', components: list(stat('$findFirstValue'), constant(0)) } },
        constant('|'), yesNo({ type: 'contains', haystack: { type: 'toLowerCase', components: stat('appunti') }, needle: constant('fighter') }),
        constant('|'), yesNo({ type: 'isNull', components: { type: 'findFirst', components: list() } })
      )
    } }
  }] };
  await page.goto('./');
  await importJson(page, JSON.stringify(source));
  await create(page, 'Mira');
  await expect(page.getByText('1,3|2|no|si', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).fill('FIGHTER');
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).press('Tab');
  await expect(page.getByText('1,3|2|si|si', { exact: true })).toBeVisible();
  await waitForWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /Mira/ }).click();
  await expect(page.getByText('1,3|2|si|si', { exact: true })).toBeVisible();
});

test('source popup drafts and validated local resources survive cancel, offline and backup', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./'); await importJson(page, JSON.stringify(viewSystem)); await create(page, 'Mira dei fogli');
  await page.getByRole('button', { name: 'Gestisci stato', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Pronto per partire' }).click();
  await page.getByRole('dialog').getByLabel('Modifica Scorte', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.getByText('Pronto', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Gestisci stato', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Pronto per partire' })).not.toBeChecked();
  await expect(page.getByRole('dialog').getByLabel('Modifica Scorte', { exact: true })).toHaveValue('6');
  await page.getByRole('checkbox', { name: 'Pronto per partire' }).click();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Pronto', { exact: true })).toBeVisible();
  await expect(page.getByText('Non supportato: on_tap_event').first()).toBeVisible();
  for (const title of ['Prima nota', 'Seconda nota']) {
    await page.getByRole('button', { name: 'Aggiungi risorsa · Nota locale', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Scrivi un titolo');
    await expect(page.getByRole('button', { name: 'Salva', exact: true })).toBeDisabled();
    await page.getByLabel('Titolo locale', { exact: true }).fill(title);
    await page.getByLabel('Testo locale', { exact: true }).fill('Un sentiero nel bosco');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button', { name: `Dettagli · ${title}`, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sposta su · Seconda nota', exact: true }).click();
  await expect(page.locator('.source-resource-item').first()).toContainText('Seconda nota');
  await page.getByRole('button', { name: 'Dettagli · Prima nota', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByLabel('Testo locale', { exact: true }).fill('Da annullare');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Dettagli · Prima nota', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Un sentiero nel bosco');
  await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: 'Scollega · Prima nota', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dettagli · Prima nota', exact: true })).not.toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /Mira dei fogli/ }).click();
  await expect(page.getByText('Pronto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dettagli · Seconda nota', exact: true })).toBeVisible();
  await navigate(page, 'Impostazioni');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const backup = readFileSync((await (await event).path())!, 'utf8');
  const data = JSON.parse(backup);
  expect(data.resources).toHaveLength(2);
  expect(data.characters[0].values.notes).toHaveLength(1);
  expect(data.characters[0].values.ready).toBe(true);
  expect(data.systems[0].original).toBe(JSON.stringify(viewSystem));
  await page.locator('input[type=file]').setInputFiles({ name: 'views.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /Mira dei fogli/ }).click();
  await expect(page.getByText('Pronto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dettagli · Seconda nota', exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
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
  await page.route('https://fixtures.polysheet.test/missing.json', route => route.fulfill({ status: 404, body: 'Not found', headers: { 'access-control-allow-origin': '*' } }));
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://fixtures.polysheet.test/missing.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 404');
  await page.route('https://fixtures.polysheet.test/cors.json', route => route.abort('failed'));
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://fixtures.polysheet.test/cors.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('CORS');
  await page.route('https://fixtures.polysheet.test/system.json', route => route.fulfill({ status: 200, body: demoOriginal, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://fixtures.polysheet.test/system.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('heading', { name: 'Sentieri', exact: true })).toBeVisible();
});

test('GitHub clone URL discovers files, validates selection and retains an immutable offline import', async ({ page, context }) => {
  const repository = 'https://github.com/derpsyhome/3rd-party-books-for-5e';
  const commit = '1'.repeat(40), treeSha = '2'.repeat(40);
  const bytes = gzipSync(demoOriginal), bad = '{"resources":[]}';
  let htmlRequests = 0, rawRequests = 0, apiRequests = 0;
  const headers = { 'access-control-allow-origin': '*' };
  await page.route(repository + '**', async route => { htmlRequests++; await route.abort('failed'); });
  await page.route('https://api.github.com/repos/derpsyhome/3rd-party-books-for-5e/**', async route => {
    apiRequests++;
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/commits')) {
      expect(url.searchParams.get('sha')).toBe('release/test');
      await route.fulfill({ headers, json: [{ sha: commit, commit: { tree: { sha: treeSha } } }] });
    } else if (url.pathname.endsWith('/git/trees/' + treeSha)) {
      expect(url.searchParams.get('recursive')).toBe('1');
      await route.fulfill({ headers, json: { sha: treeSha, truncated: false, tree: [
        { path: '5e/system.rpg', type: 'blob', mode: '100644', size: bytes.length },
        { path: 'a/system.json', type: 'blob', mode: '100644', size: Buffer.byteLength(bad) },
        { path: 'resources.rpg', type: 'blob', mode: '100644', size: 20 }
      ] } });
    } else await route.fulfill({ status: 501, body: 'Unexpected API request' });
  });
  await page.route('https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/**', async route => {
    rawRequests++;
    expect(route.request().url()).toContain('/' + commit + '/');
    await route.fulfill({ headers, body: route.request().url().endsWith('system.json') ? bad : bytes, contentType: 'application/octet-stream' });
  });
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill(repository + '.git');
  await page.getByLabel('Branch, tag o commit (facoltativo)').fill('release/test');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByLabel('File di sistema nel repository')).toBeVisible();
  expect(rawRequests).toBe(0); expect(htmlRequests).toBe(0); expect(apiRequests).toBe(2);
  await expect(page.getByLabel('File di sistema nel repository').locator('option')).toHaveCount(2);
  await page.getByLabel('File di sistema nel repository').selectOption('a/system.json');
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByLabel('File di sistema nel repository').selectOption('5e/system.rpg');
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toContainText(`/${commit}/5e/system.rpg`);
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('heading', { name: 'Sentieri', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta .rpg originale' }).click();
  const download = await downloadPromise, path = await download.path();
  if (!path) throw new Error('Missing original export');
  expect(readFileSync(path)).toEqual(bytes);
  await waitForWorker(page);
  await context.setOffline(true); await page.reload(); await navigate(page, 'Libreria sistemi');
  await expect(page.getByRole('heading', { name: 'Sentieri', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('GitHub discovery reports rate limits, missing repositories and authoring-only trees', async ({ page }) => {
  let status = 429;
  const commit = '1'.repeat(40), treeSha = '2'.repeat(40);
  await page.route('https://api.github.com/repos/owner/repo/**', route => {
    if (status !== 200) return route.fulfill({ status, body: '{}', headers: { 'access-control-allow-origin': '*' } });
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: route.request().url().includes('/commits?')
      ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
      : { sha: treeSha, truncated: false, tree: [{ path: 'stats.rpgs', type: 'blob', mode: '100644', size: 2 }] } });
  });
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill('git@github.com:owner/repo.git');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('Limite di richieste GitHub');
  status = 404;
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('non trovato o non pubblico');
  status = 200;
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('Nessun system.rpg');
  await expect(page.locator('.system-card')).toHaveCount(0);
});

if (process.env.LIVE_GITHUB_IMPORT === '1') test('live public GitHub repository resolves the pinned original system', async ({ page }) => {
  await page.goto('./'); await navigate(page, 'Libreria sistemi');
  await page.getByRole('button', { name: 'Da URL' }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://github.com/derpsyhome/3rd-party-books-for-5e.git');
  await page.getByLabel('Branch, tag o commit (facoltativo)').fill('00f55b2c3023c59f5857297dc933a7505c9b6aa4');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await page.getByLabel('File di sistema nel repository').selectOption('5e/system.rpg');
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  const preview = page.getByRole('dialog', { name: 'Prima di importare' });
  await expect(preview).toContainText('v0.6.0');
  await expect(preview).toContainText('317 statistiche');
  await expect(preview).toContainText('00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg');
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
    if (file) {
      await page.getByRole('button', { name: 'Manage conditions', exact: true }).click();
      await page.getByRole('dialog').getByRole('checkbox', { name: 'Blinded', exact: true }).click();
      await page.getByRole('button', { name: 'Annulla', exact: true }).click();
      await page.getByRole('button', { name: 'Manage conditions', exact: true }).click();
      await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'Blinded', exact: true })).not.toBeChecked();
      await page.getByRole('dialog').getByRole('checkbox', { name: 'Blinded', exact: true }).click();
      await page.getByRole('button', { name: 'Salva', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText('Blinded', { exact: true }).first()).toBeVisible();
      await page.getByText('Campi delle pagine sorgente · modifica manuale', { exact: true }).click();
      await page.getByRole('button', { name: 'Modifica · edit_character_basics_ability_scores_point_buy_composite', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Modifica Strength', { exact: true }).fill('14');
      await expect(page.getByRole('dialog').locator('.stat-block').filter({ hasText: 'point' }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Salva', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('button', { name: 'Aggiungi risorsa · Note', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Salva', exact: true })).toBeDisabled();
      await page.getByLabel('Note title', { exact: true }).fill('Original local note');
      await page.getByLabel('Note', { exact: true }).fill('Local-only regression text');
      await page.getByRole('button', { name: 'Salva', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Dettagli · Original local note', exact: true })).toBeVisible();
    }
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
    if (file) {
      expect(parsed.characters[0].values.blinded).toBe(true);
      expect(parsed.characters[0].values.strength_score).toBe(14);
      expect(parsed.characters[0].values.notes).toHaveLength(1);
    }
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
  await page.getByLabel('URL del sistema o repository GitHub').fill(url);
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
