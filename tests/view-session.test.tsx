/** @file Real scoped draft controls and transactional owner/resource regression tests. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SourceForm } from '../src/ui/SourceForm';
import { RenderView, sourceColor } from '../src/ui/renderer';
import { createEvaluator } from '../src/engine/formulas';
import { initialDrafts, manualFieldGroup, sessionViews, validationMessages } from '../src/engine/view-session';
import { parseSystem, prepareSystem } from '../src/importing/system';
import { createCharacter, initialValues, installSystem, SheetDatabase, setCharacterValue } from '../src/persistence/db';
import { commitCharacterView, commitCombatView, commitResourceView } from '../src/persistence/views';
import { createCombat, commandCombat } from '../src/persistence/combat';
import { exportBackup, restoreBackup } from '../src/persistence/backup';
import { noteEdit, conditionPopup, viewSystem } from './fixtures/views';
import { base, constant, stat } from './fixtures/capabilities';
import type { ResourceInstance } from '../src/domain/model';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
const databases: SheetDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) await db.delete(); });
async function setup() {
  const database = new SheetDatabase(`views-${crypto.randomUUID()}`); databases.push(database);
  const system = await prepareSystem(JSON.stringify(viewSystem), 'Original MIT views fixture');
  expect(system.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  await installSystem(system, database);
  const character = await createCharacter(system, 'Mira', database);
  return { database, system, character };
}

it('validates real input drafts immediately, submits once and leaves committed values untouched', async () => {
  const stats = [base('title', 'string', ''), base('body', 'string', '')];
  const values = { title: '', body: '' }, onCommit = vi.fn().mockResolvedValue(undefined), onDone = vi.fn();
  render(<SourceForm input={noteEdit} context={{ stats, values, onCommit }} onDone={onDone} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Scrivi un titolo');
  expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Testo locale'), { target: { value: 'Una strada nuova' } });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(values.body).toBe('');
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(onCommit).toHaveBeenCalledExactlyOnceWith({ body: 'Una strada nuova' }, []);
});

it('cancels popup checkboxes and numeric drafts without saving, then reopens cleanly', async () => {
  const context = { stats: viewSystem.character_stats, values: initialValues(viewSystem.character_stats), onCommit: vi.fn().mockResolvedValue(undefined) };
  render(<RenderView input={conditionPopup} context={context} />);
  fireEvent.click(screen.getByRole('button', { name: 'Gestisci stato' }));
  fireEvent.click(screen.getByLabelText('Pronto per partire'));
  fireEvent.change(screen.getByLabelText('Modifica Scorte'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(context.onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Gestisci stato' }));
  expect(screen.getByLabelText('Pronto per partire')).not.toBeChecked();
  expect(screen.getByLabelText('Modifica Scorte')).toHaveValue(6);
  fireEvent.click(screen.getByLabelText('Pronto per partire'));
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(context.onCommit).toHaveBeenCalledWith({ ready: true }, []));
});

it('blocks malformed validation results, duplicate IDs and invalid numeric inputs', () => {
  const stats = [base('number', 'integer', 2)];
  const v = { id: 'n', type: 'stat', stat: 'number', min_value_allowed: 0, max_value_allowed: 4, validation_message: constant(true) };
  expect(validationMessages(v, stats, {}, { n: 3 }).n).toMatch(/testo o null/);
  expect(() => sessionViews({ id: 'list', type: 'list', subviews: [v, v] })).toThrow('duplicato');
  const onCommit = vi.fn();
  render(<SourceForm input={{ ...v, validation_message: null }} context={{ stats, values: {}, onCommit }} onDone={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Modifica number'), { target: { value: '5' } });
  fireEvent.blur(screen.getByLabelText('Modifica number'));
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(onCommit).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('numero valido');
});

it('retains validation for prototype-named view IDs and blocks Save', () => {
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const input = { id, type: 'list', subviews: [], validation_message: constant('Valore non valido') };
    const errors = validationMessages(input, [], {}, {});
    expect(Object.getPrototypeOf(errors)).toBeNull();
    expect(Object.hasOwn(errors, id)).toBe(true);
    expect(errors[id]).toBe('Valore non valido');
    expect(validationMessages({ ...input, validation_message: constant(null) }, [], {}, {})[id]).toBeUndefined();
  }
  const onCommit = vi.fn();
  render(<SourceForm input={{ id: '__proto__', type: 'list', subviews: [], validation_message: constant('Valore non valido') }}
    context={{ stats: [], values: {}, onCommit }} onDone={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Valore non valido');
  expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(onCommit).not.toHaveBeenCalled();
});

it('renders signed/clamped/color text, source icons, chips and keeps events visible', () => {
  render(<RenderView input={{ id: 'layout', type: 'avatarSection', center_content: [
    { id: 'signed', type: 'text', text: constant(4), signed: true, max_lines: 2, color: '#123456' },
    { id: 'chip', type: 'chip', text: constant('Etichetta'), style: 'compact', background_color: 'buttonSurface', on_tap_event: { name: 'unsupported' } }
  ], bottom_right_stack: [{ id: 'icon', type: 'icon', name: 'ic_notes' }] }} context={{ stats: [], values: {} }} />);
  expect(screen.getByText('+4')).toHaveStyle({ WebkitLineClamp: '2', color: '#123456' });
  expect(screen.getByText('Etichetta')).toHaveClass('source-chip-compact');
  expect(screen.getByText('Non supportato: on_tap_event')).toBeVisible();
  expect(document.querySelector('svg')).not.toBeNull();
  expect(() => sourceColor('url(https://invalid.test)')).toThrow();
});

it('preserves drafts after failed Save and honors existing combat overrides in inputs', async () => {
  const onCommit = vi.fn().mockRejectedValue(new Error('Spazio locale esaurito'));
  render(<SourceForm input={{ id: 'hp-edit', type: 'stat', stat: 'hp' }} context={{
    stats: [base('hp', 'integer', 6)], values: { hp: 6 }, overrides: { hp: 3 }, onCommit
  }} onDone={vi.fn()} />);
  expect(screen.getByLabelText('Modifica hp')).toHaveValue(3);
  fireEvent.change(screen.getByLabelText('Modifica hp'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Spazio locale esaurito'));
  expect(screen.getByLabelText('Modifica hp')).toHaveValue(8);
  expect(screen.getByRole('button', { name: 'Salva' })).not.toBeDisabled();
});

it('keeps nested popup saves inside the outer draft and cancels both scopes', async () => {
  const inner = { ...conditionPopup, id: 'nested-popup', should_persist_on_save: false };
  const onCommit = vi.fn(), onDone = vi.fn();
  render(<SourceForm input={{ id: 'outer', type: 'list', subviews: [inner] }} context={{
    stats: viewSystem.character_stats, values: initialValues(viewSystem.character_stats), overrides: { scorte: 3 }, onCommit
  }} onDone={onDone} />);
  fireEvent.click(screen.getByRole('button', { name: 'Gestisci stato' }));
  expect(screen.getByLabelText('Modifica Scorte')).toHaveValue(3);
  fireEvent.click(screen.getByLabelText('Pronto per partire'));
  fireEvent.change(screen.getByLabelText('Modifica Scorte'), { target: { value: '9' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Salva' }).at(-1)!);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Gestisci stato' }));
  expect(screen.getByLabelText('Pronto per partire')).toBeChecked();
  expect(screen.getByLabelText('Modifica Scorte')).toHaveValue(9);
  fireEvent.click(screen.getAllByRole('button', { name: 'Annulla' }).at(-1)!);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(onDone).toHaveBeenCalledOnce();
  expect(onCommit).not.toHaveBeenCalled();
});

it('resource-backed text rejects wrong pins, and calculated lists cannot be deleted', () => {
  const resources: ResourceInstance[] = [{ id: 'r', systemKey: 'foreign', definitionId: 'local-note', name: 'Private', values: { title: 'Private', body: '' } }];
  const stats = [base('noteId', 'string', 'r'), { id: 'computed', name: 'Computed', type: 'calculated', value_type: 'array', sub_value_type: 'resource',
    components: { type: 'list', components: [constant({ resourceId: 'r' }, 'resource')] } }];
  const ctx = { systemKey: 'pinned', stats, values: {}, resources, resourceDefinitions: viewSystem.resources, onCommit: vi.fn() };
  const { rerender } = render(<RenderView input={{ id: 'label', type: 'text', resource_id: 'local-note', resource_instance_ids_stat: 'noteId', resource_display_stat: 'title' }} context={ctx} />);
  expect(screen.getByRole('status')).toHaveTextContent('versione non compatibile');
  rerender(<RenderView input={{ id: 'label', type: 'text', resource_id: 'local-note', resource_instance_ids_stat: 'noteId', resource_display_stat: 'title' }} context={{
    ...ctx, resources: resources.map(r => ({ ...r, systemKey: 'pinned' }))
  }} />);
  expect(screen.getByText('Private')).toBeVisible();
  rerender(<RenderView input={{ id: 'list', type: 'resourceSection', resource_stat: 'computed', resource_id: 'local-note' }} context={{
    ...ctx, resources: resources.map(r => ({ ...r, systemKey: 'pinned' }))
  }} />);
  expect(screen.queryByRole('button', { name: /Scollega/ })).toBeNull();
  expect(screen.getByText(/Elenco non modificabile/)).toBeVisible();
  expect(createEvaluator(stats, {}, undefined, ctx).evaluate(stat('noteId'))).toBe('r');
});

it('patches concurrent owners and appends local resources against latest state atomically', async () => {
  const { database, system, character } = await setup();
  const record = (id: string): ResourceInstance => ({ id, systemKey: system.key, definitionId: 'local-note', name: id, values: { title: id, body: '' } });
  await Promise.all(['a', 'b'].map(id => commitCharacterView(character.id, latest => ({
    notes: [...(Array.isArray(latest.notes) ? latest.notes : []), { resourceId: id }]
  }), [record(id)], database)));
  expect((await database.characters.get(character.id))?.values.notes).toHaveLength(2);
  await Promise.all([
    commitCharacterView(character.id, { ready: true, scorte: 9 }, [], database),
    setCharacterValue(character.id, 'vigore', 7, database)
  ]);
  expect((await database.characters.get(character.id))?.values).toMatchObject({ ready: true, scorte: 9, vigore: 7 });
  await expect(commitCharacterView(character.id, { ready: false, scorte: 'bad' }, [record('rolled-back')], database)).rejects.toThrow();
  expect(await database.resources.get('rolled-back')).toBeUndefined();
  await expect(commitCharacterView(character.id, { ready: false }, [{ ...record('foreign'), systemKey: 'another-pin' }], database)).rejects.toThrow();
  expect(await database.resources.get('foreign')).toBeUndefined();
  expect((await database.characters.get(character.id))?.values.ready).toBe(true);
  await commitResourceView('a', { body: 'Edited' }, [], database);
  await commitResourceView('a', { title: 'Latest' }, [], database);
  expect((await database.resources.get('a'))?.values).toEqual({ title: 'Latest', body: 'Edited' });
  const original = system.original;
  await restoreBackup(await exportBackup(database), database);
  expect((await database.systems.get(system.key))?.original).toBe(original);
  expect((await database.characters.get(character.id))?.values.notes).toHaveLength(2);
});

it('keeps multi-field combat actor patches atomic, including rollback of initializer overrides', async () => {
  const { database, system, character } = await setup();
  const combat = await createCombat(system.key, 'Prova', database);
  await commandCombat(combat.id, { type: 'add', typeId: 'scout' }, database, () => 3);
  const actor = (await database.combats.get(combat.id))!.combatants[0];
  await commitCombatView(combat.id, actor.id, { hp: 8, initiative: 4 }, [], database);
  await expect(commitCombatView(combat.id, actor.id, { hp: 1, initiative: 'invalid' }, [], database)).rejects.toThrow();
  expect((await database.combats.get(combat.id))?.combatants[0].overrides.hp).toBe(8);
  await commandCombat(combat.id, { type: 'add', typeId: 'hero', sourceId: character.id }, database);
  const hero = (await database.combats.get(combat.id))!.combatants[1];
  await setCharacterValue(character.id, 'vigore', 7, database);
  await commitCombatView(combat.id, hero.id, { ready: true, scorte: 9 }, [], database);
  expect((await database.characters.get(character.id))?.values).toMatchObject({ ready: true, scorte: 9, vigore: 7 });
});

for (const path of ['.reference/archer-system.rpg', '.reference/derpsy-system.rpg']) {
  it.skipIf(!existsSync(path))(`evaluates the six actual point-buy drafts from ${path}`, async () => {
    const { definition, diagnostics } = parseSystem(gunzipSync(readFileSync(path)).toString('utf8'));
    expect(diagnostics.filter(d => d.message.includes('contesto non disponibile: $view'))).toEqual([]);
    const nodes = sessionViews((definition.character_creation_flow[0] as { view: unknown }).view);
    const group = nodes.find(v => v.type === 'section' && Array.isArray(v.content) &&
      v.content.some(c => !!c && typeof c === 'object' && 'id' in c && c.id === 'edit_character_basics_ability_scores_point_buy_str'))!;
    expect(group).toBeDefined();
    const values = initialValues(definition.character_stats);
    const drafts = initialDrafts(group, definition.character_stats, values);
    expect(Object.keys(drafts)).toHaveLength(6);
    for (let i = 201; i <= 206; i++) {
      const key = Object.keys(drafts)[i - 201];
      const e = (value: number) => createEvaluator(definition.character_stats, values, undefined, { variables: { $view: { ...drafts, [key]: value } } }).get(definition.character_stats[i].id);
      expect(e(8)).toBe(0); expect(e(13)).toBe(5); expect(e(14)).toBe(7); expect(e(15)).toBe(9);
    }
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<SourceForm input={manualFieldGroup(group)} context={{ stats: definition.character_stats, values, onCommit }} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Modifica Strength/), { target: { value: '14' } });
    expect(screen.getByTestId(`stat-${definition.character_stats[201].id}`)).toHaveTextContent('7');
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ strength_score: 14 }, []));
  });
}
