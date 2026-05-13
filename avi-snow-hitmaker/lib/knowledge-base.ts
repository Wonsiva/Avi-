// All data below is sourced from real Spotify analytics for Avi Snow
// (https://open.spotify.com/artist/5pW2lVGlbVSVWi9086Xjfu) as of May 2026.
// Stream counts pulled from artist page; BPM/key from songbpm.com.

export const ARTIST_PROFILE = {
  name: "Avi Snow",
  monthlyListeners: 1330000,
  totalStreams: 250000000,
  topCities: ["São Paulo", "Mexico City", "Sydney", "London", "Melbourne"],
  topTracks: [
    { title: "Feel", streams: 37068311, bpm: 121, key: "A minor", length: "2:48", collaborators: ["MVCA", "Zeeba"], year: 2024 },
    { title: "Lady - Hear Me Tonight", streams: 23468387, bpm: 126, key: "B minor", length: "3:00", collaborators: ["MVCA", "Cairo"], year: 2021 },
    { title: "What I Need", streams: 12851505, bpm: 91, key: "A♭ minor", length: "2:41", collaborators: ["Sif Saga", "LVAN"], year: 2023 },
    { title: "Feel The Love", streams: 5157327, bpm: 122, key: "A minor", length: "2:48", collaborators: ["Malou", "AMEME", "Andhim"], year: 2025 },
    { title: "Breathe", streams: 1500000, bpm: 118, key: "G major", length: "4:07", collaborators: ["Carlos Santana"], year: 2021 },
    { title: "Pour It Up", streams: 1000000, bpm: 122, key: "B major", length: "3:00", collaborators: ["LVAN", "Bimini"], year: 2024 },
    { title: "Bumpin", streams: 800000, bpm: 124, key: "A♭ major", length: "3:45", collaborators: [], year: 2025 },
    { title: "Common Ground", streams: 600000, bpm: 120, key: "D minor", length: "7:07", collaborators: ["Tamir Regev", "Ben Cina"], year: 2023 },
    { title: "Freedom", streams: 500000, bpm: 112, key: "C major", length: "2:48", collaborators: [], year: 2022 },
    { title: "Sunday Highs", streams: 400000, bpm: 122, key: "A minor", length: "3:30", collaborators: ["Zeeba", "MVCA"], year: 2023 },
  ],
  // Derived patterns from the top 10
  patterns: {
    medianBPM: 122,
    dominantKeys: ["A minor", "D minor", "A♭ minor"],
    spotifyEditLength: "2:48",
    djExtendedLength: "6:30",
    hookByMs: 20000, // Hook lands by 0:20
  },
};

export const GENRE_PROFILES = {
  "organic-house": {
    label: "Organic House",
    bpmRange: [118, 124] as [number, number],
    bpmDefault: 122,
    keyDefaults: ["A minor", "D minor"],
    instruments: [
      "live nylon acoustic guitar with fingerstyle picking",
      "congas, shaker, djembe, rim hits, claps (MPC swing 58%)",
      "kalimba and oud textures",
      "warm low-pass analog pads",
      "rolling single-note sub bass side-chained to kick",
    ],
    avoidInstruments: ["supersaw", "festival lead", "plucks", "EDM build-up"],
    drop: "vocal-chop-led, no synth lead",
    references: ["Keinemusik", "&friends", "Bedouin", "Sebastien Leger"],
    playlistTargets: ["Tantra", "Dunes", "Mint", "golden hour", "Cafe del Mar"],
  },
  "melodic-afro": {
    label: "Melodic Afro House",
    bpmRange: [120, 124] as [number, number],
    bpmDefault: 122,
    keyDefaults: ["A minor", "F minor"],
    instruments: [
      "log drum lead",
      "djembe and conga polyrhythm",
      "kalimba accents",
      "nylon guitar",
      "vocal chops pitched as melodic hook",
      "rolling sub bass",
    ],
    avoidInstruments: ["supersaw", "trance lead", "festival drop"],
    drop: "log drum + vocal chops, polyrhythmic groove",
    references: ["Keinemusik", "Black Coffee", "&ME", "Adam Port", "MoBlack", "Dawn Patrol"],
    playlistTargets: ["Afro House", "House X", "Tantra", "Sunset on the Beach"],
  },
  "deep-house": {
    label: "Deep House",
    bpmRange: [118, 122] as [number, number],
    bpmDefault: 120,
    keyDefaults: ["A minor", "C minor"],
    instruments: [
      "Rhodes electric piano with jazz voicings",
      "live double bass or fretless electric",
      "soft round kick",
      "shuffled hi-hat with swing",
      "warm vinyl-style pad",
    ],
    avoidInstruments: ["festival drop", "supersaw", "trap hi-hats"],
    drop: "groove-driven, no big drop, just bass+drums lock",
    references: ["DJ Sneak", "MK", "Dennis Ferrer", "Kerri Chandler"],
    playlistTargets: ["Deep House Relax", "House Forever", "Mint"],
  },
  "melodic-house": {
    label: "Melodic House & Techno",
    bpmRange: [120, 124] as [number, number],
    bpmDefault: 123,
    keyDefaults: ["A minor", "F# minor"],
    instruments: [
      "Juno-style analog pads",
      "arpeggiated melodic lead",
      "saw lead synth",
      "rolling bassline",
      "ethereal vocal chops",
      "reverb-soaked atmosphere",
    ],
    avoidInstruments: ["nylon guitar (too organic for this lane)", "tropical pluck"],
    drop: "melodic synth lead with sub bass, cinematic build",
    references: ["Tale of Us", "Mind Against", "Innellea", "Massano", "Anyma"],
    playlistTargets: ["Melodic House & Techno", "Afterlife"],
  },
  "tropical-house": {
    label: "Tropical / Sunset House",
    bpmRange: [100, 110] as [number, number],
    bpmDefault: 104,
    keyDefaults: ["G major", "C major"],
    instruments: [
      "steel drum lead",
      "marimba",
      "acoustic guitar strumming",
      "soft kick",
      "tropical pluck synth",
      "ukulele",
    ],
    avoidInstruments: ["dark bass", "heavy distortion", "techno percussion"],
    drop: "melodic, bright, vocal-led drop",
    references: ["Kygo", "Sam Feldt", "Matoma"],
    playlistTargets: ["Tropical Morning", "Chill Vibes", "Mint"],
  },
};

export const VOCAL_STYLES = {
  "breathy-brazilian": {
    label: "Breathy Brazilian Female (Zeeba style)",
    description:
      "breathy intimate Brazilian female vocal with soft Portuguese inflection, close-mic ASMR breath texture, half-sung half-whispered, vulnerable longing surrender delivery, vocal sits intimate not loud",
    languagePhrase: "Fica comigo",
    referenceArtist: "Zeeba",
  },
  "soulful-male": {
    label: "Soulful Male (LVAN / Bimini style)",
    description:
      "soulful intimate male vocal, breathy lower register, warm chest voice, vulnerable longing delivery, no autotune sharpness",
    languagePhrase: "",
    referenceArtist: "LVAN",
  },
  "ethereal-female": {
    label: "Ethereal Female (Malou style)",
    description:
      "ethereal airy female vocal, dreamy delay-soaked delivery, soft head voice, hypnotic repetition, weightless texture",
    languagePhrase: "",
    referenceArtist: "Malou",
  },
  "african-vocal": {
    label: "African Vocalist (Idd Aziz / Tabia style)",
    description:
      "African male vocalist, Swahili or Zulu phrases, deep chest voice, call-and-response style, traditional inflection, spiritual delivery",
    languagePhrase: "Hakuna shida",
    referenceArtist: "Idd Aziz",
  },
  "instrumental": {
    label: "Instrumental (no vocals)",
    description: "",
    languagePhrase: "",
    referenceArtist: "",
  },
};

export const MOOD_PALETTES = {
  "tulum-sunset":
    "Tulum sunset Ibiza beach golden hour São Paulo rooftop emotional palette, organic warm analog not synthetic digital, cinematic and longing and hypnotic",
  "ibiza-warehouse":
    "Ibiza warehouse late-night sweat-soaked dancefloor energy, hypnotic peak-time euphoria, dark groove",
  "burning-man-sunrise":
    "Burning Man sunrise temple energy, spiritual transcendent emotional release, desert dust and warmth",
  "cafe-del-mar-chill":
    "Cafe del Mar afternoon lounge, breezy melancholic poolside relaxation, balearic warmth",
  "afterhours-melancholic":
    "afterhours melancholic introspective comedown, 4am emotional darkness, blue hour intimacy",
};

export const HOOK_WORDS = [
  "Closer", "Sundown", "Tides", "Stay", "Home", "Hold",
  "Gone", "Yours", "Light", "Falling", "Dust", "Now",
  "Open", "Free", "Lost", "Found", "Slow", "Deep",
];

export const MARKET_FOCUS = {
  "brazil": "São Paulo and Rio listeners, Portuguese vocal phrase mandatory, Tomorrowland Brazil energy",
  "latam": "Mexico City and São Paulo cluster, Spanish or Portuguese phrase optional, sunset reggaeton-adjacent groove",
  "europe": "Berlin and Ibiza clubs, sophisticated minimal arrangement, longer DJ-friendly format",
  "global": "balanced international appeal, English-dominant lyric, broad sunset-house aesthetic",
};

export const KEY_OPTIONS = [
  "A minor", "A major", "A♭ minor", "A♭ major",
  "B minor", "B major", "B♭ minor", "B♭ major",
  "C minor", "C major", "C# minor", "C# major",
  "D minor", "D major", "D# minor", "E♭ major",
  "E minor", "E major",
  "F minor", "F major", "F# minor", "F# major",
  "G minor", "G major", "G# minor", "A♭ major ",
];

export const PRESETS = {
  "feel-style-hit": {
    label: "🔥 Feel-style Hit (37M reference)",
    genre: "melodic-afro",
    bpm: 121,
    key: "A minor",
    length: "spotify-edit" as const,
    vocalStyle: "breathy-brazilian",
    mood: "tulum-sunset",
    hookWord: "Closer",
    marketFocus: "brazil",
    references: ["Keinemusik", "&friends", "Bedouin"],
  },
  "sunday-highs-vibe": {
    label: "🌅 Sunday Highs Vibe (chill)",
    genre: "organic-house",
    bpm: 122,
    key: "A minor",
    length: "spotify-edit" as const,
    vocalStyle: "breathy-brazilian",
    mood: "cafe-del-mar-chill",
    hookWord: "Sundown",
    marketFocus: "brazil",
    references: ["Keinemusik", "&friends"],
  },
  "lady-cover-energy": {
    label: "💃 Lady Cover Energy (familiar hook)",
    genre: "organic-house",
    bpm: 126,
    key: "B minor",
    length: "spotify-edit" as const,
    vocalStyle: "soulful-male",
    mood: "ibiza-warehouse",
    hookWord: "Tonight",
    marketFocus: "global",
    references: ["MK", "Dennis Ferrer", "Soave"],
  },
  "afro-deep-cut": {
    label: "🥁 Afro Deep Cut (Keinemusik lane)",
    genre: "melodic-afro",
    bpm: 122,
    key: "F minor",
    length: "dj-extended" as const,
    vocalStyle: "african-vocal",
    mood: "burning-man-sunrise",
    hookWord: "Open",
    marketFocus: "europe",
    references: ["Keinemusik", "Black Coffee", "&ME", "Adam Port"],
  },
  "custom": {
    label: "🎛️ Custom (start blank)",
    genre: "organic-house",
    bpm: 122,
    key: "A minor",
    length: "spotify-edit" as const,
    vocalStyle: "breathy-brazilian",
    mood: "tulum-sunset",
    hookWord: "Stay",
    marketFocus: "brazil",
    references: ["Keinemusik", "&friends"],
  },
};

export type PresetKey = keyof typeof PRESETS;
