/** @file Original MIT content for source forms, local notes and popup acceptance. */
import { capabilitySystem, base, constant, list, stat } from './capabilities';
export const noteEdit = {
  id: 'local-note-edit', type: 'list', padding: 16, subviews: [
    { id: 'local-note-title', type: 'text', edit_stat: 'title', label: constant('Titolo locale'), max_length: 80,
      validation_message: { type: 'when', clauses: [
        { condition: { type: 'and', components: list(
          { type: 'isEmpty', components: stat('$view.local-note-title') },
          { type: 'isEmpty', components: stat('$view.local-note-text') }
        ) }, components: constant('Scrivi un titolo o un contenuto.') },
        { condition: constant(true), components: constant(null) }
      ] } },
    { id: 'local-note-text', type: 'text', edit_stat: 'body', label: constant('Testo locale') }
  ]
};
export const conditionPopup = {
  id: 'local-condition-popup', type: 'popUpButton', text: constant('Gestisci stato'),
  pop_up_title: constant('Stato locale'), pop_up_type: 'bottomSheet', display_save_button: true,
  should_persist_on_save: true, pop_up_view: {
    id: 'local-condition-edit', type: 'list', subviews: [
      { id: 'local-ready-check', type: 'checkbox', stat: 'ready', label: constant('Pronto per partire'), label_alignment: 'right', style: 'checkbox' },
      { id: 'local-count-edit', type: 'stat', stat: 'scorte', min_value_allowed: 0, max_value_allowed: 20 }
    ]
  }
};
export const viewSystem = {
  ...capabilitySystem, id: 'original-view-tests',
  character_stats: [...capabilitySystem.character_stats, base('ready', 'bool', false), base('notes', 'array', [], 'resource')],
  resources: [...capabilitySystem.resources, {
    id: 'local-note', name: 'Nota locale', core: false, display_name: 'title',
    stats: [base('title', 'string', ''), base('body', 'string', '')],
    edit_view: noteEdit,
    list_view: { id: 'local-note-list', type: 'listItem', title: stat('title'), subtitle: stat('body') },
    display_view: { id: 'local-note-detail', type: 'text', text: stat('body'), max_lines: 4, color: 'text' }
  }],
  character_sheet_sections: [...capabilitySystem.character_sheet_sections,
    { id: 'local-portrait', view: { id: 'local-avatar', type: 'avatarSection', center_content: [
      { id: 'local-avatar-name', type: 'text', text: stat('nome'), style: 'headline' }
    ], bottom_right_stack: [{ id: 'local-note-icon', type: 'icon', name: 'ic_notes', color: 'primary', size: 'small' }] } },
    { id: 'local-conditions', view: { id: 'local-state-list', type: 'list', subviews: [
      conditionPopup, { id: 'local-ready-chip', type: 'chip', is_visible: stat('ready'), text: constant('Pronto'), background_color: 'buttonSurface', style: 'compact',
        on_tap_event: { name: 'unsupported-fixture-event' } }
    ] } },
    { id: 'local-notes', view: { id: 'local-notes-list', type: 'list', subviews: [
      { id: 'local-add-note', type: 'selectResources', stat: 'notes', resource_id: 'local-note', should_append: true, should_save_on_selection: true, create_in_place: true, view_type: 'icon' },
      { id: 'local-notes-section', type: 'resourceSection', resource_stat: 'notes', resource_id: 'local-note', reorganizable: true }
    ] } }
  ]
};
