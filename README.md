# CV Tailor

Upload a CV (PDF), point it at a job posting (URL or pasted text), and get back a tailored,
Harvard-style one-page CV. Preview it, tweak formatting (font, size, margins, line spacing),
manually edit sections, and export a matching PDF.

## Setup

1. Install dependencies:

   ```bash
   npm install
   npx playwright install chromium
   ```

2. Add an API key for your chosen LLM provider:

   ```bash
   cp .env.example .env.local
   # then edit .env.local
   ```

   By default the app uses **Anthropic (Claude)** — set `ANTHROPIC_API_KEY`. To use **Google
   Gemini** instead (it has a free tier that doesn't require billing to get started — see
   [Google AI Studio](https://aistudio.google.com)), set `LLM_PROVIDER=gemini` and
   `GEMINI_API_KEY` instead. Gemini is a reasonable free fallback but is noticeably behind Claude
   on the nuanced, context-heavy rewriting this app relies on — expect lower-quality tailoring,
   especially around transferable-skill reasoning.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

The app runs on Vercel with no code changes needed beyond what's already in this repo, but a
few things can only be set from Vercel's dashboard (not from code or `vercel.json`):

1. Connect the repo in the Vercel dashboard and deploy as a standard Next.js project — no
   special build command needed.
2. Set environment variables in the project's **Settings → Environment Variables**: whichever of
   `ANTHROPIC_API_KEY` / (`LLM_PROVIDER=gemini` + `GEMINI_API_KEY`) you're using. These are the
   same variables as `.env.local` locally, just set in Vercel's UI instead of a file.
3. Check the PDF export route's memory allocation in **Settings → Functions**. Vercel's default
   (currently 1024MB under Fluid Compute) is a reasonable starting point for launching a
   headless Chromium and rendering one page — if exports fail or time out in practice, this is
   the first thing to raise.
4. Give the deploy a real end-to-end try once it's live: upload a CV, tailor it, and download
   the PDF. The Vercel-specific browser launch path (`lib/pdf-render.ts`, using
   `@sparticuz/chromium` instead of full Playwright) is exercised only in this environment — it
   can't be fully verified without an actual deployment, so this is the one thing worth checking
   closely the first time.

Locally, dev, and on a traditional server (VPS, Docker, etc.) the app keeps using full
Playwright exactly as before — none of the above applies outside Vercel.

## How it works

- **Intake** (`/`): upload your CV PDF, provide a job URL or pasted description, and optional
  notes. The CV is parsed into structured JSON, the job posting is fetched/read, and the
  configured LLM provider tailors the CV content to the job (with a hard rule against inventing
  facts).
- **Editor** (`/editor`): live preview of the tailored CV, with a side panel to adjust formatting,
  manually edit sections/bullets, add more notes and re-tailor, and export the final PDF.
  Formatting and manual edits are session-only (kept in `localStorage`), no account or database
  required.

## Architecture

- `lib/cv-schema.ts` — the CV data model (zod schema + types).
- `lib/llm/` — provider-agnostic extraction/tailoring prompts and business logic
  (`lib/llm/index.ts`), a small `LlmProvider` interface (`lib/llm/types.ts`), and one
  implementation per backend (`lib/llm/providers/`). Select the backend via the `LLM_PROVIDER`
  env var (`anthropic` (default) or `gemini`) — swapping providers never touches the prompts,
  the schema, or the API routes that call them.
- `lib/pdf-extract.ts` — PDF → raw text.
- `lib/pdf-render.ts` — renders the CV template to PDF via Playwright, matching the browser
  preview exactly. Launches full Playwright's Chromium locally/on a traditional server, or
  `playwright-core` + `@sparticuz/chromium` on Vercel (detected via `process.env.VERCEL`), since
  Vercel's serverless functions need a Chromium build packaged for that environment instead of
  a pre-installed browser.
- `lib/autofit.ts` — logic for shrinking font/margins/spacing to fit the CV on one page.
- `components/CvDocument.tsx` — the CV template itself, used for both the live preview and the
  PDF export.
