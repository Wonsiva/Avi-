"use client";

import { useMemo } from "react";
import { Info, Wand2 } from "lucide-react";
import {
  GENRE_PROFILES,
  VOCAL_STYLES,
  MOOD_PALETTES,
  HOOK_WORDS,
  MARKET_FOCUS,
  KEY_OPTIONS,
} from "@/lib/knowledge-base";
import { GenerationParams } from "@/lib/types";

interface Props {
  params: GenerationParams;
  onChange: (next: GenerationParams) => void;
  onGenerate: () => void;
  onResetDefaults: () => void;
}

function Field({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card border border-line p-4">
      <div className="tooltip-host flex items-center gap-1.5 mb-2">
        <label className="text-xs uppercase tracking-wider text-muted font-medium">{label}</label>
        <Info size={11} className="text-muted/70" />
        <span className="tooltip">{tooltip}</span>
      </div>
      {children}
    </div>
  );
}

function humanize(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ParameterPanel({ params, onChange, onGenerate, onResetDefaults }: Props) {
  const genre = GENRE_PROFILES[params.genre as keyof typeof GENRE_PROFILES];

  const update = <K extends keyof GenerationParams>(k: K, v: GenerationParams[K]) =>
    onChange({ ...params, [k]: v });

  const onGenreChange = (g: string) => {
    const next = GENRE_PROFILES[g as keyof typeof GENRE_PROFILES];
    onChange({
      ...params,
      genre: g,
      bpm: next.bpmDefault,
      key: next.keyDefaults[0],
      references: [...next.references.slice(0, 4)],
    });
  };

  const toggleRef = (r: string) => {
    const has = params.references.includes(r);
    update("references", has ? params.references.filter((x) => x !== r) : [...params.references, r]);
  };

  const moodKeys = useMemo(() => Object.keys(MOOD_PALETTES), []);
  const marketKeys = useMemo(() => Object.keys(MARKET_FOCUS), []);

  return (
    <div className="space-y-4">
      {/* 1. Genre */}
      <Field
        label="Genre / Sub-style"
        tooltip="The musical lane. Pick the closest match to the vibe you want — this drives BPM range, instruments, and the do-not-include list."
      >
        <select
          value={params.genre}
          onChange={(e) => onGenreChange(e.target.value)}
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:border-orange-400/50 outline-none"
        >
          {Object.entries(GENRE_PROFILES).map(([k, g]) => (
            <option key={k} value={k}>
              {g.label}
            </option>
          ))}
        </select>
      </Field>

      {/* 2. References */}
      <Field
        label="Reference Artists"
        tooltip="Suno leans on these for sonic flavor. Pre-checked from the selected genre's defaults — toggle any to fine-tune."
      >
        <div className="flex flex-wrap gap-2">
          {genre.references.map((r) => {
            const on = params.references.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggleRef(r)}
                className={[
                  "px-2.5 py-1 rounded-full text-xs border transition",
                  on
                    ? "border-orange-400/50 bg-orange-400/10 text-body"
                    : "border-line text-muted hover:text-body",
                ].join(" ")}
              >
                {r}
              </button>
            );
          })}
        </div>
      </Field>

      {/* 3. BPM */}
      <Field
        label={`BPM — ${params.bpm}`}
        tooltip="Tempo in beats per minute. Avi Snow's hit cluster sits at 118–124. Each genre has its own range."
      >
        <input
          type="range"
          min={genre.bpmRange[0]}
          max={genre.bpmRange[1]}
          step={1}
          value={params.bpm}
          onChange={(e) => update("bpm", Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted mt-1">
          <span>{genre.bpmRange[0]}</span>
          <span className={params.bpm === 120 ? "text-orange-300" : ""}>120</span>
          <span className={params.bpm === 122 ? "text-orange-300" : ""}>122 (median)</span>
          <span className={params.bpm === 124 ? "text-orange-300" : ""}>124</span>
          <span>{genre.bpmRange[1]}</span>
        </div>
      </Field>

      {/* 4. Key */}
      <Field
        label="Key"
        tooltip="Root key and mode. A minor and D minor dominate Avi Snow's catalog."
      >
        <select
          value={params.key}
          onChange={(e) => update("key", e.target.value)}
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:border-orange-400/50 outline-none"
        >
          {KEY_OPTIONS.map((k) => (
            <option key={k} value={k.trim()}>
              {k.trim()}
            </option>
          ))}
        </select>
      </Field>

      {/* 5. Length */}
      <Field
        label="Length"
        tooltip="Radio Edit fits Spotify's algorithm and your median track length. DJ Extended adds 32-bar intro/outro for club play."
      >
        <div className="grid grid-cols-2 gap-2">
          {(["spotify-edit", "dj-extended"] as const).map((l) => (
            <button
              key={l}
              onClick={() => update("length", l)}
              className={[
                "px-3 py-2 rounded-lg border text-xs transition",
                params.length === l
                  ? "border-orange-400/60 text-body bg-orange-400/5"
                  : "border-line text-muted hover:text-body",
              ].join(" ")}
            >
              {l === "spotify-edit" ? "Radio Edit · 2:48" : "DJ Extended · 6:30"}
            </button>
          ))}
        </div>
      </Field>

      {/* 6. Vocal Style */}
      <Field
        label="Vocal Style"
        tooltip="Selecting Instrumental hides the lyrics field and gives you a Suno-toggle hint instead."
      >
        <select
          value={params.vocalStyle}
          onChange={(e) => update("vocalStyle", e.target.value)}
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:border-orange-400/50 outline-none"
        >
          {Object.entries(VOCAL_STYLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>

      {/* 7. Mood */}
      <Field
        label="Mood Palette"
        tooltip="The emotional & visual atmosphere that gets injected as descriptive language into both prompts."
      >
        <select
          value={params.mood}
          onChange={(e) => update("mood", e.target.value)}
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:border-orange-400/50 outline-none"
        >
          {moodKeys.map((k) => (
            <option key={k} value={k}>
              {humanize(k)}
            </option>
          ))}
        </select>
      </Field>

      {/* 8. Hook Word */}
      <Field
        label="Hook Word"
        tooltip="The one-word vocal hook that repeats on the drop. Avi Snow's title pattern: one emotional concept (Feel, Lady, Bumpin)."
      >
        <input
          type="text"
          value={params.hookWord}
          onChange={(e) => update("hookWord", e.target.value)}
          className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:border-orange-400/50 outline-none"
          placeholder="Closer"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {HOOK_WORDS.map((w) => (
            <button
              key={w}
              onClick={() => update("hookWord", w)}
              className={[
                "px-2 py-0.5 rounded text-[11px] border transition",
                params.hookWord === w
                  ? "border-orange-400/50 text-body bg-orange-400/10"
                  : "border-line text-muted hover:text-body",
              ].join(" ")}
            >
              {w}
            </button>
          ))}
        </div>
      </Field>

      {/* 9. Market */}
      <Field
        label="Market Focus"
        tooltip="Which audience the prompt is calibrated for. Affects language phrasing and arrangement length."
      >
        <div className="grid grid-cols-2 gap-2">
          {marketKeys.map((k) => (
            <button
              key={k}
              onClick={() => update("marketFocus", k)}
              className={[
                "px-2.5 py-1.5 rounded-lg border text-xs transition",
                params.marketFocus === k
                  ? "border-orange-400/60 text-body bg-orange-400/5"
                  : "border-line text-muted hover:text-body",
              ].join(" ")}
            >
              {humanize(k)}
            </button>
          ))}
        </div>
      </Field>

      {/* Generate */}
      <div className="sticky bottom-4 pt-2">
        <button
          onClick={onGenerate}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-black bg-gradient-to-r from-orange-400 via-amber-400 to-rose-400 shadow-warm hover:brightness-110 transition"
        >
          <Wand2 size={16} />
          Generate Variation
          <span className="text-[10px] opacity-70 font-normal ml-1">⌘/Ctrl+Enter</span>
        </button>
        <button
          onClick={onResetDefaults}
          className="w-full mt-2 text-xs text-muted hover:text-body transition"
        >
          Reset to Avi Snow defaults
        </button>
      </div>
    </div>
  );
}
