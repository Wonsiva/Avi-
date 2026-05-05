import { generate, writeOutput, slugify } from "../client.js";
import { getFlag, getFlagNumber, type ParsedFlags } from "../cli.js";

type Platform = "ig" | "tiktok" | "x" | "all";

function normalizePlatform(raw: string | undefined): Platform {
  const p = (raw ?? "all").toLowerCase();
  if (p === "ig" || p === "instagram") return "ig";
  if (p === "tiktok" || p === "tt") return "tiktok";
  if (p === "x" || p === "twitter") return "x";
  return "all";
}

function platformGuidance(platform: Platform): string {
  switch (platform) {
    case "ig":
      return "Target platform: Instagram. Hashtag block included. Short = under 20 words, medium = 30–60 words, long = 80–140 words.";
    case "tiktok":
      return "Target platform: TikTok. Hashtag block included. Keep captions slightly tighter than IG; TikTok captions live under the video and get skimmed. Short = under 15 words, medium = 25–50 words, long = 60–100 words.";
    case "x":
      return "Target platform: X / Twitter. NO hashtags. NO hashtag block at all. Short = under 20 words (single tweet), medium = 2-tweet thread, long = 3–4 tweet thread. Separate tweets with a blank line.";
    case "all":
    default:
      return "Generate for Instagram by default. Include hashtag block.";
  }
}

function captionGuidance(platform: Platform, variantCount: number, notes: string | undefined): string {
  const platLine = platformGuidance(platform);
  const includeHashtags = platform !== "x";

  return `You are generating social captions for Avi Snow.

${platLine}

OUTPUT FORMAT — follow exactly:

Produce ${variantCount} full set(s). Each set contains three length tiers: SHORT, MEDIUM, LONG.

Format each set like this, separated by a line of five em-dashes (—————):

## Set <n>

### Short
<caption text>
${includeHashtags ? "\n<blank line>\n<hashtag block: 5–8 lowercase tags, space-separated>" : ""}

### Medium
<caption text>
${includeHashtags ? "\n<blank line>\n<hashtag block: 5–8 lowercase tags, space-separated>" : ""}

### Long
<caption text>
${includeHashtags ? "\n<blank line>\n<hashtag block: 5–8 lowercase tags, space-separated>" : ""}

—————

Rules for captions themselves:
- Write in Avi's voice. Warm, specific, not-a-marketer. Contractions always.
- Preserve any [bracketed placeholders] from the user's context verbatim.
- Do not repeat the exact same opening across the three tiers — vary the entry point.
${includeHashtags ? "- Hashtag rules: 5–8 lowercase, no #spam stacks, mix scene-specific (afrohouse, melodictechno, endlessdream, deephouse) with 1–2 broader (housemusic, dj). One hashtag block per tier, on its own line, separated from caption body by a blank line." : "- NO hashtags. This is for X/Twitter."}
- Do NOT include preamble, explanation, or meta commentary. Start directly with "## Set 1".
${notes ? `\nAdditional steering from the user for this call:\n${notes}` : ""}`;
}

export async function runCaption(args: ParsedFlags): Promise<void> {
  const { flags } = args;
  const context = getFlag(flags, "context");
  if (!context) {
    console.error(
      [
        "",
        "caption: missing --context",
        "",
        'Example: tsx src/cli.ts caption --context "just finished a b2b with [friend] at [venue], 4am, melodic techno closer"',
        "",
      ].join("\n")
    );
    process.exit(1);
  }

  const platform = normalizePlatform(getFlag(flags, "platform"));
  const variants = getFlagNumber(flags, "variants", 3);
  const notes = getFlag(flags, "notes");

  const userMessage = [
    `Context for the caption:`,
    ``,
    context,
    ``,
    `Platform: ${platform}`,
    `Number of full sets to produce: ${variants}`,
    notes ? `\nExtra notes from Avi: ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  console.log(`\nGenerating ${variants} caption set(s) for ${platform}...\n`);

  const body = await generate({
    moduleGuidance: captionGuidance(platform, variants, notes),
    userMessage,
    maxTokens: 4096,
  });

  const slug = slugify(context, "caption");
  const header = [
    `# Caption — ${platform} — ${variants} set${variants === 1 ? "" : "s"}`,
    ``,
    `**Context:** ${context}`,
    notes ? `\n**Notes:** ${notes}` : "",
    ``,
    `---`,
    ``,
  ]
    .filter(Boolean)
    .join("\n");

  const full = header + body + "\n";
  const path = writeOutput({ module: "caption", slug, body: full });

  console.log(body);
  console.log(`\n---\nSaved to: ${path}\n`);
}
