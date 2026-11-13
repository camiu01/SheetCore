// Original content, MIT. Not a transcription of an external game.
const constant = (value: string | number, value_type = typeof value === 'number' ? 'integer' : 'string') => ({ type: 'constant', value, value_type });
const ref = (stat: string) => ({ type: 'stat', stat });
const statView = (id: string, stat: string) => ({ id, type: 'stat', stat });
export const demo = {
  id: 'polysheet-sentieri', name: 'Sentieri', abbreviation: 'SE', version: '1.0.0',
  character_display_name: 'nome',
  character_stats: [
    { id: 'nome', name: 'Nome', type: 'base', value_type: 'string', default_value: '' },
    { id: 'vigore', name: 'Vigore', abbreviation: 'VIG', type: 'base', value_type: 'integer', default_value: 2 },
    { id: 'ingegno', name: 'Ingegno', abbreviation: 'ING', type: 'base', value_type: 'integer', default_value: 3 },
    { id: 'istinto', name: 'Istinto', abbreviation: 'IST', type: 'base', value_type: 'integer', default_value: 1 },
    { id: 'slancio', name: 'Slancio', type: 'calculated', value_type: 'integer', components: { type: 'add', components: { type: 'list', components: [ref('vigore'), ref('istinto')] } } },
    { id: 'scorte', name: 'Scorte', type: 'base', value_type: 'integer', default_value: 6 },
    { id: 'appunti', name: 'Appunti di viaggio', type: 'base', value_type: 'string', default_value: '' }
  ],
  character_indexed_stats: ['nome'],
  character_search_item_view: { id: 'search_nome', type: 'text', text: ref('nome') },
  character_creation_flow: [], progression_systems: {}, mechanics: [], enumerated_types: [],
  character_sheet_sections: [
    {
      id: 'tratti',
      view: {
        id: 'tratti_section', type: 'section', show_divider: true, content_item_min_width: 140,
        header: [{ id: 'tratti_title', type: 'text', text: constant('I tuoi tratti'), style: 'title' }],
        content: [statView('vigore_view', 'vigore'), statView('ingegno_view', 'ingegno'), statView('istinto_view', 'istinto')]
      }
    },
    {
      id: 'viaggio',
      view: {
        id: 'viaggio_section', type: 'section', show_divider: true,
        header: [{ id: 'viaggio_title', type: 'text', text: constant('In viaggio'), style: 'title' }],
        content: [statView('slancio_view', 'slancio'), statView('scorte_view', 'scorte')]
      }
    },
    {
      id: 'diario',
      view: {
        id: 'diario_section', type: 'section', show_divider: true,
        header: [{ id: 'diario_title', type: 'text', text: constant('Il tuo taccuino'), style: 'title' }],
        content: [{ id: 'appunti_view', type: 'text', edit_stat: 'appunti', label: constant('Appunti di viaggio'), hint: constant('Un luogo, un incontro, qualcosa da ricordare…'), style: 'text', max_length: 4000 }]
      }
    }
  ],
  resources: [{
    id: 'ricordo', name: 'Ricordo', display_name: 'titolo',
    stats: [
      { id: 'titolo', name: 'Titolo', type: 'base', value_type: 'string', default_value: '' },
      { id: 'testo', name: 'Descrizione', type: 'base', value_type: 'string', default_value: '' }
    ],
    display_view: { id: 'ricordo_display', type: 'list', subviews: [
      { id: 'ricordo_titolo', type: 'text', text: ref('titolo'), style: 'title' },
      { id: 'ricordo_testo', type: 'text', text: ref('testo'), style: 'text' }
    ] }
  }],
  dice: [4, 6, 8, 10, 12, 20].map(faces => ({ id: `d${faces}`, name: `d${faces}`, faces }))
};
export const demoOriginal = JSON.stringify(demo, null, 2);
