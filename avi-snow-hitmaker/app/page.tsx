"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Sparkles, Github, RotateCcw } from "lucide-react";
import { ARTIST_PROFILE, PRESETS, PresetKey } from "@/lib/knowledge-base";
import { buildMusicPrompt, buildVocalPrompt } from "@/lib/prompt-builder";
import { GenerationParams, HistoryEntry, MusicPromptResult, VocalPromptResult } from "@/lib/types";
import { ParameterPanel } from "@/components/ParameterPanel";
import { PromptOutput } from "@/components/PromptOutput";
import { PresetBar } from "@/components/PresetBar";
import { HistoryPanel } from "@/components/HistoryPanel";

const STATE_KEY = "avisnow-hitmaker-state";
const HISTORY_KEY = "avisnow-hitmaker-history";

const DEFAULT_PARAMS: GenerationParams = (() => {
  const p = PRESETS["feel-style-hit"];
  return {
    genre: p.genre,
    bpm: p.bpm,
    key: p.key,
    length: p.length,
    vocalStyle: p.vocalStyle,
    mood: p.mood,
    hookWord: p.hookWord,
    marketFocus: p.marketFocus,
    references: p.references,
  };
})();

function presetMatch(params: GenerationParams): PresetKey | null {
  const entries = Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][];
  for (const [key, p] of entries) {
    if (
      p.genre === params.genre &&
      p.bpm === params.bpm &&
      p.key === params.key &&
      p.length === params.length &&
      p.vocalStyle === params.vocalStyle &&
      p.mood === params.mood &&
      p.hookWord === params.hookWord &&
      p.marketFocus === params.marketFocus
    ) {
      return key;
    }
  }
  return null;
}

export default function Page() {
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [hydrated, setHydrated] = useState(false);
  const [music, setMusic] = useState<MusicPromptResult>(() => buildMusicPrompt(DEFAULT_PARAMS, 1));
  const [vocal, setVocal] = useState<VocalPromptResult>(() => buildVocalPrompt(DEFAULT_PARAMS, 1));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [seed, setSeed] = useState<number>(1);
  const activePreset = useMemo(() => presetMatch(params), [params]);

  // ─── Hydrate from localStorage on mount ─────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as GenerationParams;
        setParams({ ...DEFAULT_PARAMS, ...saved });
      }
      const rawHist = localStorage.getItem(HISTORY_KEY);
      if (rawHist) setHistory(JSON.parse(rawHist) as HistoryEntry[]);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // ─── Persist params ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STATE_KEY, JSON.stringify(params));
  }, [params, hydrated]);

  // ─── Persist history ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, hydrated]);

  // ─── Debounced live regeneration on parameter change ───────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setMusic(buildMusicPrompt(params, seed));
      setVocal(buildVocalPrompt(params, seed));
    }, 200);
    return () => clearTimeout(t);
  }, [params, seed]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const copy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard`);
      } catch {
        showToast("Copy failed — select and copy manually");
      }
    },
    [showToast],
  );

  // Logs an entry and produces a fresh variation (new random seed).
  const generate = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 1_000_000);
    setSeed(newSeed);
    const m = buildMusicPrompt(params, newSeed);
    const v = buildVocalPrompt(params, newSeed);
    setMusic(m);
    setVocal(v);
    const presetLabel = activePreset ? PRESETS[activePreset].label : undefined;
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      params,
      music: m,
      vocal: v,
      presetLabel,
    };
    setHistory((h) => [entry, ...h].slice(0, 20));
    showToast("New variation generated");
  }, [params, activePreset, showToast]);

  // Cmd/Ctrl+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [generate]);

  const loadPreset = useCallback((key: PresetKey) => {
    const p = PRESETS[key];
    setParams({
      genre: p.genre,
      bpm: p.bpm,
      key: p.key,
      length: p.length,
      vocalStyle: p.vocalStyle,
      mood: p.mood,
      hookWord: p.hookWord,
      marketFocus: p.marketFocus,
      references: [...p.references],
    });
  }, []);

  const restoreFromHistory = useCallback((entry: HistoryEntry) => {
    setParams(entry.params);
    setMusic(entry.music);
    setVocal(entry.vocal);
    setHistoryOpen(false);
    showToast("Restored from history");
  }, [showToast]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    showToast("History cleared");
  }, [showToast]);

  const fmtListeners = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : `${(n / 1000).toFixed(0)}K`;

  return (
    <main className="relative z-10">
      {/* ─── Top bar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/70 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight sunset-text">
              Avi Snow&apos;s Hit Maker
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Every parameter calibrated against 250M+ streams
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen(true)}
              className="p-2 rounded-lg border border-line hover:border-orange-400/40 hover:text-orange-300 transition"
              aria-label="History"
              title="History"
            >
              <History size={18} />
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg border border-line hover:border-orange-400/40 hover:text-orange-300 transition"
              aria-label="GitHub"
              title="GitHub"
            >
              <Github size={18} />
            </a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-card border border-line text-body">
            <span className="text-muted mr-1">●</span>
            {fmtListeners(ARTIST_PROFILE.monthlyListeners)} monthly listeners
          </span>
          <span className="px-2.5 py-1 rounded-full bg-card border border-line text-body">
            <span className="text-muted mr-1">●</span>
            Top market: {ARTIST_PROFILE.topCities[0]}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-card border border-line text-body">
            <span className="text-muted mr-1">●</span>
            Median BPM: {ARTIST_PROFILE.patterns.medianBPM}
          </span>
        </div>
      </header>

      {/* ─── Preset bar ──────────────────────────────────────────────── */}
      <PresetBar activeKey={activePreset} onSelect={loadPreset} />

      {/* ─── Main split ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-2">
          <ParameterPanel
            params={params}
            onChange={setParams}
            onGenerate={generate}
            onResetDefaults={() => loadPreset("feel-style-hit")}
          />
        </div>
        <div className="md:col-span-3 space-y-6">
          <PromptOutput
            title="Music Prompt"
            icon="🎹"
            description="Paste into Suno's main prompt box."
            tabs={[
              { label: "Prompt", value: music.prompt, copyLabel: "Music Prompt" },
            ]}
            receipts={music.receipts}
            onCopy={copy}
          />
          <PromptOutput
            title="Vocal Prompt"
            icon="🎤"
            description={
              params.vocalStyle === "instrumental"
                ? "Instrumental mode — toggle Suno's Instrumental switch ON."
                : "Style + Lyrics for Suno's Custom Mode."
            }
            tabs={
              params.vocalStyle === "instrumental"
                ? [{ label: "Note", value: vocal.styleField, copyLabel: "Note" }]
                : [
                    { label: "Style Field", value: vocal.styleField, copyLabel: "Style Field" },
                    { label: "Lyrics Field", value: vocal.lyricsField, copyLabel: "Lyrics Field" },
                  ]
            }
            receipts={vocal.receipts}
            onCopy={copy}
          />
          <div className="text-xs text-muted flex items-center gap-2">
            <Sparkles size={12} className="text-orange-300" />
            Tip: press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-card border border-line text-body">
              {typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}+Enter
            </kbd>{" "}
            to generate a fresh variation with the same params.
            <button
              onClick={() => loadPreset("feel-style-hit")}
              className="ml-auto inline-flex items-center gap-1 text-muted hover:text-orange-300 transition"
            >
              <RotateCcw size={11} /> Reset to Avi Snow defaults
            </button>
          </div>
        </div>
      </div>

      {/* ─── History slide-out ──────────────────────────────────────── */}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onRestore={restoreFromHistory}
        onClear={clearHistory}
      />

      {/* ─── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-card border border-orange-400/30 text-sm shadow-warm"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
