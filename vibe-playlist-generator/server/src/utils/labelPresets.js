// Label Mode presets.
//
// Biases the seed pool toward the rosters of a few taste-making labels that
// define the modern afro/organic/melodic house sound. When Label Mode is on,
// these artist names override whatever the genre preset would have used as
// seed_artists.

const LABEL_PRESETS = {
  moblack: {
    label: 'MoBlack Records',
    artists: [
      'MoBlack',
      'Caiiro',
      'Enoo Napa',
      'Manoo',
      'Atmos Blaq',
    ],
  },
  keinemusik: {
    label: 'Keinemusik',
    artists: [
      'Keinemusik',
      '&ME',
      'Rampa',
      'Adam Port',
      'Reznik',
    ],
  },
  'dawn-patrol': {
    label: 'Dawn Patrol',
    artists: [
      'Bedouin',
      'Dawn Patrol',
      'Acid Pauli',
      'YokoO',
      'Be Svendsen',
    ],
  },
};

function getLabel(labelKey) {
  return LABEL_PRESETS[labelKey] || null;
}

module.exports = { LABEL_PRESETS, getLabel };
