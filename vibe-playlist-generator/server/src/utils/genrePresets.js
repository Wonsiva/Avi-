// Genre presets.
//
// Spotify's `seed_genres` list is famously limited — "afro-house",
// "melodic-techno", "organic-house" don't exist as valid seeds. We get
// dramatically better results by seeding with curated artists that define
// each vibe and using the genre's typical tempo band as a tempo target.
//
// Artists are stored by *name* and resolved to Spotify IDs on first use
// (cached in-memory) so the project stays self-contained — no hard-coded IDs
// that could rot if Spotify ever re-keys them.

const GENRE_PRESETS = {
  'afro-house': {
    label: 'Afro House',
    // Typical club range
    bpm: { min: 120, max: 124, target: 122 },
    // Fall back to Spotify's known seeds if we can't resolve any artists
    fallbackGenres: ['house', 'afrobeat'],
    seedArtists: [
      'Keinemusik',
      '&ME',
      'Black Coffee',
      'Rampa',
      'Adam Port',
    ],
  },
  'melodic-tech': {
    label: 'Melodic Tech',
    bpm: { min: 120, max: 124, target: 122 },
    fallbackGenres: ['minimal-techno', 'detroit-techno'],
    seedArtists: [
      'Mind Against',
      'Tale Of Us',
      'Adriatique',
      'Massano',
      'Anyma',
    ],
  },
  'deep-house': {
    label: 'Deep House',
    bpm: { min: 118, max: 124, target: 121 },
    fallbackGenres: ['deep-house', 'house'],
    seedArtists: [
      'Lane 8',
      'Yotto',
      'Ben Böhmer',
      'Nora En Pure',
      'Dixon',
    ],
  },
  'organic-house': {
    label: 'Organic House',
    bpm: { min: 116, max: 122, target: 119 },
    fallbackGenres: ['house', 'chill'],
    seedArtists: [
      'Bedouin',
      'Acid Pauli',
      'YokoO',
      'Be Svendsen',
      'Monolink',
    ],
  },
};

function getPreset(genreKey) {
  return GENRE_PRESETS[genreKey] || GENRE_PRESETS['afro-house'];
}

module.exports = { GENRE_PRESETS, getPreset };
