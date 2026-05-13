"use client";

import { useState } from "react";
import { Copy, ChevronDown } from "lucide-react";

interface Tab {
  label: string;
  value: string;
  copyLabel: string;
}

interface Props {
  title: string;
  icon: string;
  description: string;
  tabs: Tab[];
  receipts: string[];
  onCopy: (text: string, label: string) => void;
}

export function PromptOutput({ title, icon, description, tabs, receipts, onCopy }: Props) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(true);
  const tab = tabs[Math.min(active, tabs.length - 1)];

  return (
    <section className="rounded-xl border border-line bg-card shadow-warm/30 overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-line flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <span>{icon}</span> {title}
          </h2>
          <p className="text-xs text-muted truncate">{description}</p>
        </div>
        <button
          onClick={() => onCopy(tab.value, tab.copyLabel)}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line hover:border-orange-400/50 hover:text-orange-300 text-xs transition"
          aria-label={`Copy ${tab.copyLabel}`}
        >
          <Copy size={12} /> Copy
        </button>
      </header>

      {tabs.length > 1 && (
        <div className="px-4 sm:px-5 pt-3 flex gap-2 border-b border-line/60">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActive(i)}
              className={[
                "px-3 py-1.5 text-xs rounded-t-md border-b-2 transition",
                active === i
                  ? "text-body border-orange-400"
                  : "text-muted hover:text-body border-transparent",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <pre className="px-4 sm:px-5 py-4 text-xs sm:text-[13px] font-mono whitespace-pre-wrap text-body leading-relaxed bg-bg/40 max-h-[420px] overflow-auto scrollbar-thin">
        {tab.value || "—"}
      </pre>

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-muted hover:text-body border-t border-line/60 transition"
      >
        <span className="uppercase tracking-wider">Receipts — how this maps to Avi Snow data</span>
        <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
      </button>
      {open && (
        <ul className="px-4 sm:px-5 pb-4 space-y-1.5 text-xs text-body/90">
          {receipts.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-orange-300 mt-0.5">▸</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
