"use client";

import { X, RotateCcw } from "lucide-react";
import { HistoryEntry } from "@/lib/types";
import { GENRE_PROFILES } from "@/lib/knowledge-base";

interface Props {
  open: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HistoryPanel({ open, onClose, history, onRestore, onClear }: Props) {
  return (
    <>
      <div
        onClick={onClose}
        className={[
          "fixed inset-0 z-30 bg-black/60 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />
      <aside
        className={[
          "fixed top-0 right-0 z-40 h-full w-full sm:w-[400px] bg-card border-l border-line shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-line">
          <h2 className="text-sm font-semibold">History</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-line hover:border-orange-400/40 transition"
            aria-label="Close history"
          >
            <X size={14} />
          </button>
        </div>

        <div className="h-[calc(100%-110px)] overflow-y-auto scrollbar-thin">
          {history.length === 0 ? (
            <p className="text-xs text-muted px-4 py-6">
              No history yet. Hit Generate to record variations here (capped at 20).
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((entry, i) => {
                const genre = GENRE_PROFILES[entry.params.genre as keyof typeof GENRE_PROFILES];
                return (
                  <li key={`${entry.timestamp}-${i}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{timeAgo(entry.timestamp)}</p>
                        <p className="text-sm font-medium mt-0.5 truncate">
                          {entry.presetLabel ?? `${genre?.label ?? entry.params.genre} · ${entry.params.bpm} BPM`}
                        </p>
                        <p className="text-[11px] text-muted mt-1 truncate">
                          {entry.params.key} · &ldquo;{entry.params.hookWord}&rdquo; ·{" "}
                          {entry.params.vocalStyle.replace("-", " ")}
                        </p>
                      </div>
                      <button
                        onClick={() => onRestore(entry)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-line text-xs hover:border-orange-400/50 hover:text-orange-300 transition"
                      >
                        <RotateCcw size={11} />
                        Restore
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-line bg-card">
          <button
            onClick={onClear}
            disabled={history.length === 0}
            className="text-xs text-muted hover:text-rose-300 disabled:opacity-40 transition"
          >
            Clear History
          </button>
        </div>
      </aside>
    </>
  );
}
