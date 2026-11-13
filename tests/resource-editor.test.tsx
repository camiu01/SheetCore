/** @file Explicit manual editing when original resource forms cannot run. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ResourceEditor } from '../src/ui/ResourceEditor';
import { db, createCharacter, initialValues, installSystem, setCharacterValue } from '../src/persistence/db';
import { prepareSystem } from '../src/importing/system';
import { createEvaluator } from '../src/engine/formulas';
import { RenderView } from '../src/ui/renderer';
import { viewSystem } from './fixtures/views';
import { commitResourceView } from '../src/persistence/views';
import { saveResource } from '../src/persistence/resources';
import { it as copy } from '../src/ui/it';
import { base, stat } from './fixtures/capabilities';

beforeEach(async () => { await db.open(); });
afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

it('isolates a deferred ticker error, keeps sibling controls and recovers after an input change', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const stats = [base('items', 'array', [], 'integer'), base('current', 'integer', 1), {
    id: 'maximum', name: 'Maximum', type: 'calculated', value_type: 'integer',
    components: { type: 'max', components: stat('items') }
  }];
  const input = { id: 'container', type: 'list', subviews: [
    { id: 'counter', type: 'ticker', stat: 'current', label: stat('maximum') },
    { id: 'editable', type: 'stat', stat: 'current' }
  ] };
  const rendered = render(<RenderView input={input} context={{ stats, values: {}, onChange: vi.fn() }} />);
  expect(screen.getByText('maximum: max richiede una lista non vuota', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: 'Modifica current' })).toBeEnabled();
  rendered.rerender(<RenderView input={input} context={{ stats, values: { items: [5] }, onChange: vi.fn() }} />);
  expect(screen.queryByText('maximum: max richiede una lista non vuota', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText('5', { exact: true })).toBeInTheDocument();
});

it('keeps manual edits local on cancel and preserves concurrent fields and archive names on save', async () => {
  const system = await prepareSystem(JSON.stringify(viewSystem), 'Original MIT regression fixture');
  await installSystem(system);
  const definition = system.definition.resources.find(d => d.id === 'local-note');
  if (!definition) throw new Error('Missing note definition');
  const record = { id: 'note', systemKey: system.key, definitionId: definition.id, name: 'Archive name',
    values: { title: 'Old title', body: 'Old body' } };
  await saveResource(record);
  const run = async (action: () => Promise<unknown>) => { await action(); };
  const done = vi.fn();
  const props = { system, definition, editing: record, resources: [record], onSelect: vi.fn(), onDone: done, run };
  let rendered = render(<ResourceEditor {...props} />);
  fireEvent.change(screen.getByLabelText('Titolo locale'), { target: { value: 'Uncommitted source draft' } });
  fireEvent.click(screen.getByRole('button', { name: copy.manualResourceEditor }));
  expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Old title');
  fireEvent.change(screen.getByRole('textbox', { name: 'title' }), { target: { value: 'Cancelled title' } });
  fireEvent.blur(screen.getByRole('textbox', { name: 'title' }));
  fireEvent.click(screen.getByRole('button', { name: copy.cancel }));
  expect((await db.resources.get(record.id))?.values).toEqual(record.values);
  rendered.unmount();
  rendered = render(<ResourceEditor {...props} />);
  fireEvent.click(screen.getByRole('button', { name: copy.manualResourceEditor }));
  fireEvent.change(screen.getByRole('textbox', { name: 'title' }), { target: { value: 'New title' } });
  fireEvent.blur(screen.getByRole('textbox', { name: 'title' }));
  await commitResourceView(record.id, { body: 'Concurrent body' });
  await db.resources.update(record.id, { name: 'Concurrent archive name' });
  fireEvent.click(screen.getByRole('button', { name: copy.saveResource }));
  await waitFor(() => expect(done).toHaveBeenCalledTimes(2));
  expect(await db.resources.get(record.id)).toMatchObject({
    name: 'Concurrent archive name', values: { title: 'New title', body: 'Concurrent body' }
  });
  rendered.unmount();
});

it('keeps the manual draft and stored record unchanged when a reference cannot be saved', async () => {
  const source = { ...viewSystem, resources: viewSystem.resources.map(d => d.id === 'local-note'
    ? { ...d, stats: [...d.stats, base('link', 'resource', null)] } : d) };
  const system = await prepareSystem(JSON.stringify(source), 'Original MIT reference-failure fixture');
  await installSystem(system);
  const definition = system.definition.resources.find(d => d.id === 'local-note');
  if (!definition) throw new Error('Missing note definition');
  const record = { id: 'note', systemKey: system.key, definitionId: definition.id, name: 'Archive name',
    values: { title: 'Old title', body: 'Old body', link: null } };
  await saveResource(record);
  const missing = { ...record, id: 'missing', name: 'Unavailable resource' };
  const errors: unknown[] = [];
  const done = vi.fn();
  const busy = vi.fn();
  render(<ResourceEditor system={system} definition={definition} editing={record} resources={[missing]}
    onSelect={vi.fn()} onDone={done} onBusyChange={busy} run={async action => {
      try { await action(); } catch (error) { errors.push(error); }
    }} />);
  fireEvent.click(screen.getByRole('button', { name: copy.manualResourceEditor }));
  fireEvent.change(screen.getByRole('textbox', { name: 'title' }), { target: { value: 'Retained draft' } });
  fireEvent.blur(screen.getByRole('textbox', { name: 'title' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'link' }), { target: { value: missing.id } });
  fireEvent.click(screen.getByRole('button', { name: copy.saveResource }));
  await waitFor(() => expect(errors).toHaveLength(1));
  expect(done).not.toHaveBeenCalled();
  expect(busy.mock.calls).toEqual([[true], [false]]);
  expect(await db.resources.get(record.id)).toMatchObject(record);
  expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Retained draft');
  expect(screen.getByRole('button', { name: copy.saveResource })).toBeEnabled();
});

it.skipIf(!existsSync('.reference/reported-system.rpg'))('recovers original HP, AC and description through explicit class and race resources', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync('.reference/reported-system.rpg')).toString('utf8'), 'Local reported HP fixture');
  await installSystem(system);
  const character = await createCharacter(system, 'Manual HP regression');
  expect(() => createEvaluator(system.definition.character_stats, character.values).get('max_hp'))
    .toThrow('max_hp: classes_hp_mods: max richiede una lista non vuota');
  const original = createEvaluator(system.definition.character_stats, character.values);
  expect(() => original.get('armor_class')).toThrow('armor_class: classes_ac: max richiede una lista non vuota');
  expect(() => original.get('description')).toThrow('Statistica mancante nel percorso: race.name');
  const status = system.definition.character_sheet_sections[4].view;
  const context = { stats: system.definition.character_stats, values: character.values,
    resourceDefinitions: system.definition.resources, enumerations: system.definition.enumerated_types };
  const avatar = render(<RenderView input={system.definition.character_sheet_sections[0].view} context={context} />);
  expect(screen.queryByText('Non supportato: menuButton')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Menu della sorgente' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Long rest' }));
  expect(screen.getByText(/Evento importato non eseguito da PolySheet.*trigger_long_rest/)).toBeInTheDocument();
  avatar.unmount();
  const reportedError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const sheet = render(<><RenderView input={status} context={context} /><button>Other sheet controls</button></>);
  expect(screen.getByText('max_hp: classes_hp_mods: max richiede una lista non vuota', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Other sheet controls' })).toBeEnabled();
  expect(screen.queryByText('Statistica mancante: $edit_mode')).not.toBeInTheDocument();
  const run = async (action: () => Promise<unknown>) => { await action(); };
  const done = vi.fn();
  for (const [index, [definitionId, archiveName]] of [['class', 'Manual class'], ['class_details', 'Manual class details'], ['race', 'Manual race']].entries()) {
    const definition = system.definition.resources.find(d => d.id === definitionId);
    if (!definition) throw new Error('Missing original class definition');
    const resources = await db.resources.toArray();
    const rendered = render(<ResourceEditor system={system} definition={definition} editing="new" resources={resources}
      onSelect={vi.fn()} onDone={done} run={run} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apri editor manuale dei valori base' }));
    fireEvent.change(screen.getByLabelText('Nome nell’archivio'), { target: { value: archiveName } });
    if (definitionId !== 'class_details') {
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: archiveName } });
      fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }));
    } else {
      fireEvent.change(screen.getByLabelText('Class', { exact: true }), { target: { value: resources[0].id } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Class level' }), { target: { value: '2' } });
      fireEvent.blur(screen.getByRole('spinbutton', { name: 'Class level' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salva risorsa' }));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(index + 1));
    rendered.unmount();
  }
  const resources = await db.resources.toArray();
  const details = resources.find(r => r.definitionId === 'class_details');
  if (!details) throw new Error('Missing saved class details');
  const race = resources.find(r => r.definitionId === 'race');
  if (!race) throw new Error('Missing saved race');
  await setCharacterValue(character.id, 'classes', [{ resourceId: details.id }]);
  await setCharacterValue(character.id, 'race', { resourceId: race.id });
  await setCharacterValue(character.id, 'dexterity_score', 14);
  await setCharacterValue(character.id, 'constitution_score', 14);
  await setCharacterValue(character.id, 'base_hp', 10);
  const saved = await db.characters.get(character.id);
  if (!saved) throw new Error('Missing character');
  const evaluator = createEvaluator(system.definition.character_stats, saved.values, undefined, {
    resources, resourceDefinitions: system.definition.resources
  });
  expect(evaluator.get('level')).toBe(2);
  expect(evaluator.get('classes_hp_mods')).toBe(4);
  expect(evaluator.get('max_hp')).toBe(14);
  expect(evaluator.get('classes_ac')).toBe(12);
  expect(evaluator.get('race_ac')).toBe(12);
  expect(evaluator.get('armor_class')).toBe(12);
  expect(evaluator.get('description')).toBe('Manual race Manual class 2');
  sheet.rerender(<RenderView input={status} context={{ ...context, values: saved.values, resources }} />);
  expect(screen.getByText('/ 14 HP', { exact: true })).toBeInTheDocument();
  expect(screen.queryByText('max_hp: classes_hp_mods: max richiede una lista non vuota', { exact: true })).not.toBeInTheDocument();
  reportedError.mockRestore();
  expect(system.original).toBe(gunzipSync(readFileSync('.reference/reported-system.rpg')).toString('utf8'));
  expect(initialValues(system.definition.character_stats).classes).toEqual([]);
});
