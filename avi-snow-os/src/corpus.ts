import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const BRAND_DIR = join(ROOT, "brand");
const CORPUS_DIR = join(BRAND_DIR, "voice-corpus");
const BRAND_KIT = join(BRAND_DIR, "brand-kit.md");
const PROJECTS = join(BRAND_DIR, "projects.md");

const SAMPLE_COUNT = 10;
const MAX_SAMPLE_WORDS = 800;
const KNOWN_PREFIXES = ["caption", "interview", "bio", "press", "email", "note"];

export type Sample = {
  label: string;
  filename: string;
  text: string;
  truncated: boolean;
};

export type Corpus = {
  brandKit: string;
  projects: string;
  samples: Sample[];
  corpusEmpty: boolean;
  totalSamplesAvailable: number;
};

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}

function labelFor(filename: string): string {
  const base = basename(filename, extname(filename)).toLowerCase();
  const prefix = base.split(/[-_]/)[0] ?? "";
  return KNOWN_PREFIXES.includes(prefix) ? prefix : "sample";
}

function truncateByWords(text: string, max: number): { text: string; truncated: boolean } {
  const words = text.split(/\s+/);
  if (words.length <= max) return { text, truncated: false };
  return { text: words.slice(0, max).join(" ") + " […]", truncated: true };
}

function listCorpusFiles(): string[] {
  if (!existsSync(CORPUS_DIR)) return [];
  return readdirSync(CORPUS_DIR)
    .filter((f) => {
      if (f.toLowerCase() === "readme.md") return false;
      if (f.startsWith(".")) return false;
      const full = join(CORPUS_DIR, f);
      if (!statSync(full).isFile()) return false;
      const ext = extname(f).toLowerCase();
      return ext === ".md" || ext === ".txt";
    });
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export function loadCorpus(opts: { sampleCount?: number } = {}): Corpus {
  const sampleCount = opts.sampleCount ?? SAMPLE_COUNT;
  const brandKit = readIfExists(BRAND_KIT);
  const projects = readIfExists(PROJECTS);
  const files = listCorpusFiles();

  const picked = shuffle(files).slice(0, sampleCount);
  const samples: Sample[] = picked.map((filename) => {
    const raw = readFileSync(join(CORPUS_DIR, filename), "utf8").trim();
    const { text, truncated } = truncateByWords(raw, MAX_SAMPLE_WORDS);
    return { label: labelFor(filename), filename, text, truncated };
  });

  return {
    brandKit,
    projects,
    samples,
    corpusEmpty: files.length === 0,
    totalSamplesAvailable: files.length,
  };
}

export function formatCorpusForPrompt(corpus: Corpus): string {
  const parts: string[] = [];

  if (corpus.brandKit) {
    parts.push("# BRAND KIT\n\n" + corpus.brandKit);
  }
  if (corpus.projects) {
    parts.push("# CURRENT PROJECTS\n\n" + corpus.projects);
  }

  if (corpus.samples.length > 0) {
    const formatted = corpus.samples
      .map(
        (s, i) =>
          `## Sample ${i + 1} — type: ${s.label}${s.truncated ? " (truncated)" : ""}\n\n${s.text}`
      )
      .join("\n\n---\n\n");
    parts.push(
      `# VOICE CORPUS — ${corpus.samples.length} of ${corpus.totalSamplesAvailable} samples\n\n` +
        `These are real pieces of Avi's past writing. Absorb the rhythm, specificity, and posture. Do not quote from them directly.\n\n` +
        formatted
    );
  }

  return parts.join("\n\n===\n\n");
}

export function warnIfCorpusEmpty(corpus: Corpus): void {
  if (!corpus.corpusEmpty) return;
  const bar = "━".repeat(60);
  console.warn(
    [
      "",
      bar,
      "⚠  WARNING: brand/voice-corpus/ is empty.",
      "",
      "   Output will be generic until you drop real writing in there.",
      "   See brand/voice-corpus/README.md for the 1-minute bootstrap.",
      bar,
      "",
    ].join("\n")
  );
}
