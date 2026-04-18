import Anthropic from "@anthropic-ai/sdk";
import { config as loadEnv } from "dotenv";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCorpus, formatCorpusForPrompt, warnIfCorpusEmpty, type Corpus } from "./corpus.js";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "out");

export const MODELS = {
  generation: "claude-opus-4-7",
  utility: "claude-haiku-4-5-20251001",
} as const;

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "\nMissing ANTHROPIC_API_KEY. Copy .env.example to .env and fill it in.\n"
    );
    process.exit(1);
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

const VOICE_CONTRACT = `You are Avi Snow's writing partner. You are not a chatbot. You do not narrate. You write content in Avi's voice, as if Avi wrote it.

RULES — treat as non-negotiable:

1. Voice is warm, relationship-first, community-oriented. Introspective without being precious. Confident without sounding like a marketer.
2. Contractions always. Mix short sentences with long ones. Specifics over abstractions — real venues, real BPMs, real moods.
3. BANNED PHRASES — never use: "dive in", "deep dive", "unleash", "elevate", "game-changer", "journey" (as a noun), "in today's world", "harness the power of", "level up", "unlock", "at the end of the day", "passionate about", "crafted with". No emoji chains. No hashtag spam. No LinkedIn-sounding sentences.
4. Credentials listed in the BRAND KIT are the only credentials you may reference. Never invent collaborations, streams, labels, or placements.
5. Bracketed placeholders like [friend], [venue], [BPM] are fill-in-later slots. Preserve them verbatim. Do not hallucinate real names.
6. If you don't have a specific detail, say less — don't pad.
7. Output the content only. No preambles ("Here are three captions..."), no meta-commentary, no options menus. Just the content, formatted as requested.`;

export function buildSystemPrompt(corpus: Corpus, moduleGuidance: string): string {
  const voiceContext = formatCorpusForPrompt(corpus);
  return [
    VOICE_CONTRACT,
    "",
    "===",
    "",
    voiceContext,
    "",
    "===",
    "",
    "# MODULE INSTRUCTIONS",
    "",
    moduleGuidance,
  ].join("\n");
}

export type GenerateArgs = {
  moduleGuidance: string;
  userMessage: string;
  maxTokens?: number;
  utility?: boolean;
};

export async function generate(args: GenerateArgs): Promise<string> {
  const corpus = loadCorpus();
  warnIfCorpusEmpty(corpus);
  const client = getClient();
  const model = args.utility ? MODELS.utility : MODELS.generation;
  const maxTokens = args.maxTokens ?? 4096;

  const system = buildSystemPrompt(corpus, args.moduleGuidance);

  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: args.userMessage }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return text;
}

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function slugify(input: string, fallback = "draft"): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  return s || fallback;
}

export type WriteOutputArgs = {
  module: string;
  slug: string;
  body: string;
  subdir?: string;
};

export function writeOutput(args: WriteOutputArgs): string {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const stamp = today();
  const filename = `${stamp}-${args.module}-${args.slug}.md`;
  const path = args.subdir
    ? join(OUT_DIR, args.subdir, filename)
    : join(OUT_DIR, filename);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, args.body, "utf8");
  return path;
}

export function writeOutputRaw(subpath: string, body: string): string {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, subpath);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, body, "utf8");
  return path;
}

export function dateStamp(): string {
  return today();
}
