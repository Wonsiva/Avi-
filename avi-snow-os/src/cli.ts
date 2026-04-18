#!/usr/bin/env node
import { runCaption } from "./modules/caption.js";

export type ParsedFlags = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

export function parseArgs(argv: string[]): ParsedFlags {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

export function getFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

export function getFlagNumber(
  flags: Record<string, string | boolean>,
  key: string,
  fallback: number
): number {
  const raw = getFlag(flags, key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const HELP = `Avi Snow OS — personal marketing + content engine

Usage:
  avi <module> [options]

Modules (v1 shipped):
  caption           IG / TikTok / X caption (3 variants: short/medium/long)

Modules (coming):
  release-campaign  full 4–6 week campaign for a track
  newsletter        fan newsletter
  sync-pitch        cold pitch to a music supervisor
  promoter-email    booking inquiry / follow-up
  epk               bio / press paragraphs (50 / 150 / 300 words)
  investor-update   monthly Endless Dream Records update

Shared flags:
  --variants N      how many whole sets to generate (default: 3)
  --notes "..."     one-off steering for this call

Caption flags:
  --context "..."   what the caption is about (required)
  --platform <ig|tiktok|x|all>   default: all
`;

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const { positional, flags } = parseArgs(rest);

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return;
  }

  switch (cmd) {
    case "caption":
      await runCaption({ positional, flags });
      return;
    case "release-campaign":
    case "newsletter":
    case "sync-pitch":
    case "promoter-email":
    case "epk":
    case "investor-update":
      console.log(`\n'${cmd}' isn't built yet — v1 ships 'caption' first. Coming next.\n`);
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nError:", err instanceof Error ? err.message : err);
  process.exit(1);
});
