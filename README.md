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
  preview exactly.
- `lib/autofit.ts` — logic for shrinking font/margins/spacing to fit the CV on one page.
- `components/CvDocument.tsx` — the CV template itself, used for both the live preview and the
  PDF export.
