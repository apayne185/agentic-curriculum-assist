import { randomUUID } from "crypto";
import {
  type CvContent,
  type TailorResult,
  cvContentSchema,
  tailorResultSchema,
} from "../cv-schema";
import type { LlmProvider } from "./types";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";

const PROVIDERS: Record<string, () => LlmProvider> = {
  anthropic: () => new AnthropicProvider(),
  gemini: () => new GeminiProvider(),
};

let provider: LlmProvider | null = null;
function getProvider(): LlmProvider {
  if (!provider) {
    const name = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
    const factory = PROVIDERS[name];
    if (!factory) {
      throw new Error(
        `Unknown LLM_PROVIDER "${name}". Supported: ${Object.keys(PROVIDERS).join(", ")}.`,
      );
    }
    provider = factory();
  }
  return provider;
}

function withIds(content: CvContent): CvContent {
  return {
    header: content.header,
    sections: content.sections.map((section, sIdx) => ({
      ...section,
      id: section.id || randomUUID(),
      order: section.order ?? sIdx,
      entries: section.entries?.map((entry) => ({
        ...entry,
        id: entry.id || randomUUID(),
      })),
    })),
  };
}

const EXTRACTION_SYSTEM_PROMPT = `You convert raw text extracted from a CV/resume PDF into structured JSON.

Rules:
- Preserve the substance of the original CV faithfully. Do not invent, embellish, or drop information.
- Segment the text into logical sections (e.g. Education, Experience, Skills, Projects, Certifications, Publications, Volunteering, Languages) based on what the original CV actually contains — do not force sections that aren't present, and do not omit unusual sections just because they don't fit a template.
- Within "entries" sections, each entry should capture one role/degree/item, with its own title, subtitle (e.g. employer or institution), location, date range, and bullet points.
- Use "skills" kind for a simple skills/languages/tools list better expressed as a single line.
- Use "freeform" kind only when content genuinely doesn't fit the entries/skills shape (e.g. a short summary paragraph).
- Order sections the same way they appeared in the original CV (set "order" ascending starting at 0).
- Every section and entry needs a unique "id" string (use short random strings).
- Extract the person's name and a single contact line (phone, email, location, separated by " | "), plus any links (LinkedIn, portfolio, GitHub) as a "links" array.
- Every entry must include a "bullets" array (use an empty array if the entry has no bullet points).`;

export async function extractCvFromText(rawText: string): Promise<CvContent> {
  const result = await getProvider().runStructuredTool({
    system: EXTRACTION_SYSTEM_PROMPT,
    userContent: `Raw CV text extracted from a PDF:\n\n---\n${rawText}\n---\n\nConvert this into the structured CV JSON via the tool call.`,
    toolName: "submit_cv",
    toolDescription: "Submit the structured CV JSON extracted from the raw text.",
    schema: cvContentSchema,
  });
  return withIds(result);
}

const TAILORING_SYSTEM_PROMPT = `You are an expert resume writer who tailors a candidate's CV to a specific job posting, in the style taught by university career centers (e.g. Harvard OCS): concise, action-verb-led bullets, no first-person pronouns, consistent tense (past tense for past roles, present tense for current roles), quantified impact where genuinely supported by the source material.

CONTEXT IS EVERYTHING. Before rewording anything, reason through:
1. The candidate's career stage — student, intern, early-career, mid-level, senior — inferred from dates, titles, and institution/company context. Calibrate the seniority and confidence of language to match. Do not describe an internship task with language that implies ownership or scope it didn't have (e.g. do not turn "assisted with reporting" into "led financial strategy"). Conversely, do not undersell substantial ownership a student or early-career person actually had.
2. Transferable and dual-purpose skills: a single piece of experience often satisfies multiple job requirements when framed correctly, and experience gained in one context (school project, volunteering, a different industry) can be genuinely relevant to a job that doesn't use the same vocabulary. Explicitly look for these mappings, for example:
   - A class project using SQL/Python/statistics maps to a "data analyst" posting's technical requirements.
   - Running a student club's budget or fundraising maps to "financial analysis," "stakeholder management," or "budget ownership" requirements.
   - Retail or hospitality work often demonstrates "customer service," "conflict resolution," and "working under pressure" — relevant even to unrelated roles that list soft skills.
   - A research assistantship demonstrates "attention to detail," "independent problem solving," and often specific technical tools.
   Only make these connections when they are honestly supported by what the candidate actually did — reframe and surface the connection, never invent the underlying fact.
3. What the job posting is actually asking for: read its requirements/responsibilities and prioritize the candidate's most relevant experience and skills higher (reorder bullets and sections by relevance), while still representing their full background honestly.

HARD CONSTRAINTS (never violate these):
- Never invent employers, job titles, dates, degrees, metrics, or skills that are not present or directly, honestly inferable from the input CV.
- Never fabricate numbers. If the original bullet has no number, do not add a fabricated percentage or dollar amount — you may add a number only if it is already stated somewhere in the source content.
- Do not change the factual meaning of what someone did, only how it's worded and which parts are emphasized.
- Preserve every section and entry that exists unless the user's own notes explicitly ask to remove something — you may reorder, reword, and re-prioritize, but do not silently delete real experience.

You will be given the candidate's current CV as JSON, the job description text (and possibly a job URL), and optional additional notes from the candidate. Return a full revised CV JSON via the tool call: rewrite/reorder bullets and sections for relevance and impact per the rules above, and also return a country/market detection for the job (to choose paper size and regional conventions):
- Infer the likely country/market from the job URL's domain, any location mentioned in the posting, currency/date formats, and language/spelling conventions (e.g. UK vs US English, "CV" vs "resume" terminology).
- Set paperSize to "letter" if the market is the US or Canada, otherwise "a4".
- Set confident to false if you cannot reasonably tell (ambiguous or missing location signals) rather than guessing.
- Regardless of market, do not add a photo, date of birth, marital status, or similarly personal fields not already present in the candidate's CV.

If the candidate's current CV already reflects manual edits from a previous pass, treat it as the source of truth for factual content and preserve anything not relevant to the new instructions — only change what the job description or the candidate's new notes call for.`;

export async function tailorCv(params: {
  currentCv: CvContent;
  jobDescriptionText: string;
  jobUrl?: string;
  notes?: string;
}): Promise<TailorResult> {
  const userContent = [
    `Candidate's current CV (JSON):\n${JSON.stringify(params.currentCv, null, 2)}`,
    params.jobUrl ? `Job posting URL: ${params.jobUrl}` : null,
    `Job description text:\n---\n${params.jobDescriptionText}\n---`,
    params.notes ? `Additional notes from the candidate:\n${params.notes}` : null,
    `Tailor the CV to this job following your system instructions, and submit the result via the tool call.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await getProvider().runStructuredTool({
    system: TAILORING_SYSTEM_PROMPT,
    userContent,
    toolName: "submit_tailored_cv",
    toolDescription:
      "Submit the tailored CV JSON and the job's country/paper-size detection.",
    schema: tailorResultSchema,
  });

  return {
    cv: withIds(result.cv),
    countryDetection: result.countryDetection,
  };
}
