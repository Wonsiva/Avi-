# Setup Walkthrough — Avi Snow OS in Claude Projects

This gets you from zero to "generating captions in your voice" in about 10 minutes. No install, no code, no terminal.

---

## What you need

- A Claude account at **claude.ai** (Pro plan, $20/mo — required for Projects)
- 5–10 minutes
- A few examples of your past writing (old IG captions, a bio, any interview you've done)

---

## Step 1 — Create the Project (2 min)

1. Go to **https://claude.ai**
2. Log in (or sign up → upgrade to Pro)
3. In the left sidebar, click **Projects**
4. Click **Create Project** (top right)
5. Name it: **Avi Snow OS**
6. Description: *"Personal marketing + content engine. Generates captions, campaigns, emails, press in my voice."*
7. Click **Create Project**

## Step 2 — Paste the Custom Instructions (1 min)

1. Inside the project, look for **Set custom instructions** (or the "Edit project instructions" button, depending on UI version)
2. Open the file **`project-instructions.md`** from this folder
3. Copy the **entire contents** (Cmd+A, Cmd+C)
4. Paste it into the instructions box
5. Click **Save**

That's the brain installed.

## Step 3 — Upload your voice corpus (3–5 min)

This is what makes it sound like *you* instead of generic ChatGPT.

1. Still inside the project, find **Project Knowledge** (or "Add content" / "Upload files" — UI label varies)
2. Upload **any of these** that you have, as `.txt` or `.md` or even pasted into a plain text file:
   - 3–5 of your best past IG/TikTok captions (one per file, or all in one doc — either works)
   - 1 artist bio you've actually approved
   - 1 interview transcript or Q&A
   - 1 newsletter you've sent
   - 1 cold email to a promoter or supervisor that got a response

**Quick way to do this on Mac:**
- Open TextEdit → Format → Make Plain Text
- Paste in one caption
- Save as `caption-01.txt` on your Desktop
- Drag into the Claude Project Knowledge area
- Repeat for the others

**Minimum viable corpus:** even 3 files is enough to start. You can always add more later — just drop them into Project Knowledge and the project will pick them up.

## Step 4 — Test it (1 min)

Start a new chat inside the project. Type:

```
caption: just finished a b2b with [friend] at [venue], 4am, melodic techno closer
```

You should get back 3 caption sets, each with short / medium / long versions, with hashtag blocks. If the voice feels off, keep adding samples to Project Knowledge and retry.

## Step 5 — Use it daily

Open the project any time you need content. See **quick-reference.md** for example prompts for all 7 modules.

---

## Things that will make the voice tighter over time

- Add more samples to Project Knowledge as you write stuff you like
- When a generated draft feels off, paste it back with *"too marketer-y, try again more casual"* or *"tighten the rhythm, more like how I'd say it out loud"* — the project will course-correct
- If it keeps making the same mistake, update the Custom Instructions (add a new rule) and save

## Things to watch for

- **Model version.** In project settings, make sure the model is set to **Claude Opus 4.7** (the smartest). Haiku is faster but thinner.
- **Project Knowledge is private** to you by default. Don't sweat privacy on past writing unless it's genuinely sensitive.
- **New chats = fresh context.** Each generation is a new chat; it won't remember what you asked yesterday unless you're in the same conversation. That's fine — the Custom Instructions and Project Knowledge load every time.

---

## If something's not working

- **Output sounds generic** → Project Knowledge is empty or sparse. Add 3–5 more samples.
- **Output uses banned phrases** → Start a new chat (sometimes a long conversation drifts). If it keeps happening, the Custom Instructions didn't save — paste them again.
- **It's inventing credentials** → Paste the Custom Instructions again. The credentials rule is in there.
- **It's ignoring [brackets]** → Add a new line to your prompt: *"preserve bracketed placeholders verbatim."*

Tell me the exact output and I can tune the Custom Instructions.
