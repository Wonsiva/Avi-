# voice-corpus/

Drop your actual writing in here. The more you drop, the more the generator sounds like you.

## How it works

On every generation, the system pulls **10 random samples** from this folder and stuffs them into the model's system prompt as reference material. Samples rotate per call so output doesn't ossify around the same 10 examples.

## File naming

Prefix each file with its type so the system prompt can label it:

- `caption-<anything>.md` — past IG / TikTok captions
- `interview-<anything>.md` — interview answers (yours, transcribed)
- `bio-<anything>.md` — artist bios at any length
- `press-<anything>.md` — press blurbs, one-sheets, reviews you liked
- `email-<anything>.md` — newsletters, promoter emails, sync pitches you've sent
- `note-<anything>.md` — voice notes transcribed, freeform writing

Anything without a recognized prefix will still be used, just labeled `sample`.

## Rules

- Plain `.md` or `.txt`, either is fine
- Samples over ~800 words get truncated in-prompt (a `[…]` marker is added)
- No private stuff you don't want echoed back — the model will absolutely pick up on it
- Don't bother editing them. Raw > polished. The goal is capturing how you actually write.

## First drop — suggested

To bootstrap the voice, start with:

- 3–5 of your best IG captions (the ones that felt like you)
- 1 long-form artist bio you've actually approved
- 1 interview transcript
- 1 newsletter you've sent that you liked
- 1 cold email that got a response

That's enough for the system to stop sounding generic on call one.
