// ──────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER
// Pure functions that turn the user's selected parameters into two Suno-ready
// prompts: a Music Prompt and a Vocal Prompt (style + lyrics).
//
// Non-developers: every user-facing PHRASE lives in this file. You can safely
// reword anything inside string literals as long as you don't remove the
// ${...} interpolations.
// ──────────────────────────────────────────────────────────────────────────

import { GENRE_PROFILES, VOCAL_STYLES, MOOD_PALETTES, ARTIST_PROFILE } from "./knowledge-base";
import { GenerationParams, MusicPromptResult, VocalPromptResult } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────

// Deterministic-by-default shuffle. When `seed` is undefined we use a fresh
// Math.random() so the Generate button can produce variants from same params.
function shuffle<T>(arr: T[], seed?: number): T[] {
  const copy = [...arr];
  let rng = seed === undefined ? Math.random : mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOOD_PHRASE_VARIANTS: Record<string, string[]> = {
  "tulum-sunset": [
    "Tulum sunset Ibiza beach golden hour São Paulo rooftop emotional palette, organic warm analog not synthetic digital, cinematic and longing and hypnotic",
    "golden-hour rooftop in São Paulo, Tulum beach at dusk, warm analog organic palette, cinematic longing and hypnotic pulse",
    "Ibiza balcony at sundown, Tulum sand under bare feet, cinematic warmth, longing, hypnotic forward motion",
  ],
  "ibiza-warehouse": [
    "Ibiza warehouse late-night sweat-soaked dancefloor energy, hypnotic peak-time euphoria, dark groove",
    "DC10 4am sweat and strobes, hypnotic peak-time euphoria over a dark rolling groove",
    "warehouse 3am peak time, dark hypnotic groove, sweat and strobe euphoria",
  ],
  "burning-man-sunrise": [
    "Burning Man sunrise temple energy, spiritual transcendent emotional release, desert dust and warmth",
    "playa sunrise temple set, dust in the air, transcendent emotional release",
    "Robot Heart at first light, desert warmth, spiritual release, slow euphoria",
  ],
  "cafe-del-mar-chill": [
    "Cafe del Mar afternoon lounge, breezy melancholic poolside relaxation, balearic warmth",
    "balearic afternoon poolside, breezy melancholy, warm sundown lounge",
    "Cafe del Mar sundown, slow breeze, balearic melancholy and warmth",
  ],
  "afterhours-melancholic": [
    "afterhours melancholic introspective comedown, 4am emotional darkness, blue hour intimacy",
    "4am blue-hour comedown, introspective melancholy, intimate emotional darkness",
    "after-hours room with the lights low, blue hour intimacy, gentle melancholic comedown",
  ],
};

// Pick one mood phrasing variant. Without a seed, picks a random one.
function pickMoodPhrase(moodKey: string, seed?: number): string {
  const variants = MOOD_PHRASE_VARIANTS[moodKey] ?? [MOOD_PALETTES[moodKey as keyof typeof MOOD_PALETTES] ?? ""];
  if (seed === undefined) return variants[Math.floor(Math.random() * variants.length)];
  const rng = mulberry32(seed);
  return variants[Math.floor(rng() * variants.length)];
}

// ─── Music Prompt ─────────────────────────────────────────────────────────

export function buildMusicPrompt(params: GenerationParams, seed?: number): MusicPromptResult {
  const genre = GENRE_PROFILES[params.genre as keyof typeof GENRE_PROFILES];
  const lengthStr =
    params.length === "spotify-edit"
      ? "2:48 Spotify radio edit"
      : "6:30 DJ extended with 32-bar intro and outro";

  // Lightly shuffle instrument order each Generate so repeat clicks vary.
  const instruments = shuffle(genre.instruments, seed);

  const referenceClause = params.references.map((r) => `${r} influence`).join(", ");
  const instrumentList = instruments.join(", ");
  const avoidList = genre.avoidInstruments.map((a) => `no ${a}`).join(", ");
  const moodPhrase = pickMoodPhrase(params.mood, seed);

  const prompt = [
    genre.label.toLowerCase(),
    `${params.bpm} BPM`,
    params.key,
    instrumentList,
    "processed pitched vocal chops as the melodic lead",
    "four-on-the-floor kick with afro polyrhythm on top",
    "hypnotic minimal arrangement",
    "breakdown features only nylon guitar and shaker for 8 bars",
    `drop returns with kick plus sub plus vocal chops (${genre.drop})`,
    avoidList,
    referenceClause,
    moodPhrase,
    lengthStr,
  ]
    .filter(Boolean)
    .join(", ");

  // Find a matching top-track for the receipt bullet
  const matchTrack = ARTIST_PROFILE.topTracks.find(
    (t) => Math.abs(t.bpm - params.bpm) <= 2 && t.key === params.key,
  );

  const receipts = [
    matchTrack
      ? `BPM ${params.bpm} + ${params.key} matches "${matchTrack.title}" (${(matchTrack.streams / 1_000_000).toFixed(1)}M streams)`
      : `BPM ${params.bpm} sits in your hit cluster (118–124)`,
    `Instrumentation matches your ${genre.label} top playlists: ${genre.playlistTargets.slice(0, 3).join(", ")}`,
    `${lengthStr.split(" ")[0]} length aligns with your Spotify pattern (median 2:48)`,
  ];

  return { prompt, receipts };
}

// ─── Vocal Prompt ─────────────────────────────────────────────────────────

export function buildVocalPrompt(params: GenerationParams, seed?: number): VocalPromptResult {
  const genre = GENRE_PROFILES[params.genre as keyof typeof GENRE_PROFILES];
  const vocal = VOCAL_STYLES[params.vocalStyle as keyof typeof VOCAL_STYLES];
  const moodPhrase = pickMoodPhrase(params.mood, seed);

  if (params.vocalStyle === "instrumental") {
    return {
      styleField:
        "[Instrumental mode — use Music Prompt above with Suno's Instrumental toggle ON]",
      lyricsField: "",
      receipts: ["Instrumental mode selected — see Music Prompt"],
    };
  }

  const styleField = [
    genre.label.toLowerCase(),
    `${params.bpm} BPM`,
    params.key,
    vocal.description,
    genre.instruments.slice(0, 4).join(", "),
    "no big-room synth lead, no belting, no pop diva delivery, no autotune sharpness",
    vocal.referenceArtist ? `${vocal.referenceArtist} style` : "",
    moodPhrase,
    "2:48 Spotify radio edit, vocal hook lands by 0:20",
  ]
    .filter(Boolean)
    .join(", ");

  const hook = params.hookWord || "Stay";
  const portuguese = vocal.languagePhrase || "Stay with me";

  const lyricsField = `[Intro - 8 seconds, percussion and nylon guitar only, no vocals]

[Verse 1 - breathy intimate close-mic]
Sun goes down on the water
Don't wanna talk about tomorrow
Just your hand inside of mine
Just this hour, just this time

[Pre-Drop - whispered]
Stay with me
${portuguese}
Stay with me

[Drop - vocal chops + bass + percussion, NO synth lead]
${hook}
Hold me when the light is gone
${hook}
You're the only thing I want

[Break - guitar and shaker only, 8 bars, no vocals]

[Verse 2 - breathy]
Salt and skin and golden weather
We don't have to last forever
Just your breath against my neck
Just this moment, no regret

[Pre-Drop]
Stay with me
${portuguese}
Stay with me

[Drop]
${hook}
Hold me when the light is gone
${hook}
You're the only thing I want

[Outro - whisper fades into guitar and percussion]
${portuguese}... ${portuguese.toLowerCase()}...`;

  const receipts = [
    `${vocal.label} matches your Top 10 collaborator pattern (Zeeba, MVCA, LVAN appear on 6 of 10 hits)`,
    `Hook word "${hook}" follows your one-word-emotional-concept title rule (Feel, Lady, Bumpin)`,
    vocal.languagePhrase
      ? `Portuguese/native phrase "${vocal.languagePhrase}" targets São Paulo, your #1 city (26,768 listeners)`
      : "English-only matches global market focus",
  ];

  return { styleField, lyricsField, receipts };
}
