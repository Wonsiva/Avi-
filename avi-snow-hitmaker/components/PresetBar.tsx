"use client";

import { PRESETS, PresetKey } from "@/lib/knowledge-base";

interface Props {
  activeKey: PresetKey | null;
  onSelect: (key: PresetKey) => void;
}

export function PresetBar({ activeKey, onSelect }: Props) {
  const entries = Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][];
  return (
    <div className="border-b border-line bg-bg/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto scrollbar-thin">
        <span className="shrink-0 text-xs uppercase tracking-wider text-muted self-center mr-1">
          Presets
        </span>
        {entries.map(([key, p]) => {
          const active = activeKey === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={[
                "shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm border transition whitespace-nowrap",
                active
                  ? "border-orange-400/60 text-body shadow-warm bg-card"
                  : "border-line text-muted hover:text-body hover:border-orange-400/40",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
