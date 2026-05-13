# Avi Snow's Hit Maker

A single-page web app that generates Suno-ready prompts (one Music prompt + one Vocal prompt) calibrated to produce hits in the artistic style of **Avi Snow** — every parameter is mapped to real Spotify hit data from his 250M+ stream catalog.

![screenshot placeholder](./docs/screenshot.png)

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

One-line Vercel deploy:

```bash
npx vercel
```

Or click: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## How it works

- **Pure client-side** — no backend, no LLM calls. Deterministic prompt assembly from the knowledge base.
- **Live regeneration** — every parameter change updates both prompts within 200ms.
- **Variants on demand** — the Generate button re-shuffles instrument order and picks a fresh mood phrasing so you can get 3–5 unique variants from the same params.
- **Persistence** — your last settings and last 20 generations are kept in `localStorage`.
- **Keyboard shortcut** — `Cmd/Ctrl+Enter` to regenerate.

## How to add a new genre

Open `lib/knowledge-base.ts` and add a new entry to `GENRE_PROFILES`:

```ts
"my-new-genre": {
  label: "My New Genre",
  bpmRange: [120, 128],
  bpmDefault: 124,
  keyDefaults: ["A minor"],
  instruments: ["instrument 1", "instrument 2", ...],
  avoidInstruments: ["don't include this"],
  drop: "what happens at the drop",
  references: ["Artist 1", "Artist 2"],
  playlistTargets: ["Playlist Name"],
},
```

The dropdown, BPM range, key defaults, and reference chips will pick it up automatically.

## How to add a new vocal style

Open `lib/knowledge-base.ts` and add an entry to `VOCAL_STYLES`:

```ts
"my-vocal-style": {
  label: "My Vocal Style",
  description: "long descriptive phrase passed verbatim to Suno's Style field",
  languagePhrase: "Optional native-language phrase",
  referenceArtist: "Reference Vocalist",
},
```

The new style appears in the Vocal Style dropdown immediately.

## Editing prompt phrasing

All user-facing phrases live in `lib/prompt-builder.ts`. The file is heavily commented — non-developers can safely reword anything inside string literals, as long as you don't remove the `${...}` interpolations.

## File layout

```
avi-snow-hitmaker/
├── app/
│   ├── page.tsx              Main UI (client component)
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── knowledge-base.ts     All hard-coded data
│   ├── prompt-builder.ts     Template engine
│   └── types.ts
├── components/
│   ├── ParameterPanel.tsx
│   ├── PromptOutput.tsx
│   ├── PresetBar.tsx
│   └── HistoryPanel.tsx
└── README.md
```

## Tech

Next.js 14 (App Router) · TypeScript strict · Tailwind CSS · lucide-react.
