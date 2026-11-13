/** @file Renderer integration: source-driven labels, editing, and safe fallbacks. */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RenderView } from '../src/ui/renderer';
import { parseSystem } from '../src/importing/system';
import { demoOriginal } from '../src/demo';
import { initialValues } from '../src/persistence/db';

it('renders source sections and emits an edit of the original base stat', () => {
  const { definition } = parseSystem(demoOriginal);
  const onChange = vi.fn();
  render(<RenderView input={definition.character_sheet_sections[0].view} context={{ stats: definition.character_stats, values: initialValues(definition.character_stats), onChange }} />);
  expect(screen.getByText('I tuoi tratti')).toBeInTheDocument();
  expect(screen.getByTestId('stat-vigore')).toHaveTextContent('2');
  fireEvent.change(screen.getByLabelText('Modifica Vigore'), { target: { value: '7' } });
  fireEvent.blur(screen.getByLabelText('Modifica Vigore'));
  expect(onChange).toHaveBeenCalledWith('vigore', 7);
});
it('shows unknown components and does not run imported HTML', () => {
  const { rerender } = render(<RenderView input={{ id: 'x', type: 'unverifiedView' }} context={{ stats: [], values: {} }} />);
  expect(screen.getByText('Non supportato: unverifiedView')).toBeInTheDocument();
  rerender(<RenderView input={{ id: 'html', type: 'text', text: { type: 'constant', value_type: 'string', value: '<img src=x onerror=alert(1)>' } }} context={{ stats: [], values: {} }} />);
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  expect(document.querySelector('img')).toBeNull();
});
it('makes unsupported events visible while preserving supported stat display', () => {
  const { definition } = parseSystem(demoOriginal);
  render(<RenderView input={{ id: 'v', type: 'stat', stat: 'vigore', on_tap_event: { name: 'unimplemented' } }} context={{ stats: definition.character_stats, values: {} }} />);
  expect(screen.getByTestId('stat-vigore')).toHaveTextContent('2');
  expect(screen.getByText('Non supportato: on_tap_event')).toBeInTheDocument();
});
it('does not report absent serialized avatar events as unsupported', () => {
  const input = { id: 'avatar', type: 'avatarSection', center_content: [],
    bottom_left_button_event: { name: 'show_information' }, bottom_right_button_event: null };
  const { rerender } = render(<RenderView input={input} context={{ stats: [], values: {} }} />);
  expect(screen.getByText('Non supportato: bottom_left_button_event', { exact: true })).toBeInTheDocument();
  rerender(<RenderView input={{ ...input, bottom_left_button_event: null }} context={{ stats: [], values: {} }} />);
  expect(screen.queryByText(/Non supportato/)).not.toBeInTheDocument();
});
it('shows evaluation failures instead of crashing the sheet', () => {
  render(<RenderView input={{ id: 'v', type: 'stat', stat: 'missing' }} context={{ stats: [], values: {} }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Statistica mancante');
});
it('supports serialized null defaults, checkbox enabling, and numeric validation', () => {
  const onChange = vi.fn();
  const bool = { id: 'ready', name: 'Pronto', type: 'base', value_type: 'bool', default_value: false } as const;
  const context = { stats: [bool], values: {}, onChange };
  const { rerender } = render(<RenderView input={{ id: 'v', type: 'checkbox', stat: 'ready', enabled: null, is_visible: null }} context={context} />);
  fireEvent.click(screen.getByLabelText('Pronto'));
  expect(onChange).toHaveBeenCalledWith('ready', true);
  rerender(<RenderView input={{ id: 'v', type: 'checkbox', stat: 'ready', enabled: { type: 'constant', value_type: 'bool', value: false } }} context={context} />);
  expect(screen.getByLabelText('Pronto')).toBeDisabled();
  const { definition } = parseSystem(demoOriginal);
  rerender(<RenderView input={{ id: 'v', type: 'stat', stat: 'vigore', min_value_allowed: 0, max_value_allowed: 10 }} context={{ stats: definition.character_stats, values: {}, onChange }} />);
  onChange.mockClear();
  fireEvent.change(screen.getByLabelText('Modifica Vigore'), { target: { value: '11' } });
  fireEvent.blur(screen.getByLabelText('Modifica Vigore'));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Inserisci un numero valido');
});
