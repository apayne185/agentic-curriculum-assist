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

2. Add your Anthropic API key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local and set ANTHROPIC_API_KEY
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## How it works

- **Intake** (`/`): upload your CV PDF, provide a job URL or pasted description, and optional
  notes. The CV is parsed into structured JSON, the job posting is fetched/read, and Claude
  tailors the CV content to the job (with a hard rule against inventing facts).
- **Editor** (`/editor`): live preview of the tailored CV, with a side panel to adjust formatting,
  manually edit sections/bullets, add more notes and re-tailor, and export the final PDF.
  Formatting and manual edits are session-only (kept in `localStorage`), no account or database
  required.

## Architecture

- `lib/cv-schema.ts` — the CV data model (zod schema + types).
- `lib/claude.ts` — Claude prompts for CV extraction and job-tailoring.
- `lib/pdf-extract.ts` — PDF → raw text.
- `lib/pdf-render.ts` — renders the CV template to PDF via Playwright, matching the browser
  preview exactly.
- `lib/autofit.ts` — logic for shrinking font/margins/spacing to fit the CV on one page.
- `components/CvDocument.tsx` — the CV template itself, used for both the live preview and the
  PDF export.
