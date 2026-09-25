import { z } from "zod";

export const FONT_FAMILIES = [
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Arial",
  "Calibri",
] as const;

export const PAPER_SIZES = ["letter", "a4"] as const;

export const cvStyleSchema = z.object({
  fontFamily: z.enum(FONT_FAMILIES).default("Georgia"),
  fontSizePt: z.number().min(8).max(13).default(10.5),
  lineHeight: z.number().min(0.9).max(1.5).default(1.15),
  marginIn: z
    .object({
      top: z.number().min(0.3).max(1.5).default(0.75),
      right: z.number().min(0.3).max(1.5).default(0.75),
      bottom: z.number().min(0.3).max(1.5).default(0.75),
      left: z.number().min(0.3).max(1.5).default(0.75),
    })
    .default({ top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 }),
  sectionSpacingPt: z.number().min(2).max(24).default(10),
  accentColor: z.string().default("#111111"),
  paperSize: z.enum(PAPER_SIZES).default("letter"),
});
export type CvStyle = z.infer<typeof cvStyleSchema>;

export const DEFAULT_CV_STYLE: CvStyle = cvStyleSchema.parse({});

export const countryDetectionSchema = z.object({
  countryGuess: z.string().optional(),
  paperSize: z.enum(PAPER_SIZES),
  confident: z.boolean(),
});
export type CountryDetection = z.infer<typeof countryDetectionSchema>;

// US/Canada use Letter; everywhere else uses A4. Used to resolve a paper
// size directly from a user-confirmed country (see the intake page's
// "which country is this job in?" fallback), so that an explicit user
// choice is authoritative and never re-litigated by a model's own
// (possibly conflicting) inference on a later call.
const LETTER_COUNTRIES = new Set(["United States", "Canada"]);

export function paperSizeForCountry(country: string): (typeof PAPER_SIZES)[number] {
  return LETTER_COUNTRIES.has(country) ? "letter" : "a4";
}

export const cvEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  location: z.string().optional(),
  dateRange: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});
export type CvEntry = z.infer<typeof cvEntrySchema>;

export const cvSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  kind: z.enum(["entries", "freeform", "skills"]),
  entries: z.array(cvEntrySchema).optional(),
  freeformText: z.string().optional(),
  skillsLine: z.string().optional(),
  order: z.number(),
  visible: z.boolean().default(true),
});
export type CvSection = z.infer<typeof cvSectionSchema>;

export const cvHeaderSchema = z.object({
  name: z.string(),
  contactLine: z.string(),
  links: z.array(z.string()).optional(),
});
export type CvHeader = z.infer<typeof cvHeaderSchema>;

export const cvDocumentSchema = z.object({
  header: cvHeaderSchema,
  sections: z.array(cvSectionSchema),
  style: cvStyleSchema,
});
export type CvDocument = z.infer<typeof cvDocumentSchema>;

// Schema used for LLM extraction/tailoring tool calls: no `style`, since
// style is either defaulted (extraction) or preserved client-side (tailoring)
// and shouldn't be re-invented by the model on every call.
export const cvContentSchema = z.object({
  header: cvHeaderSchema,
  sections: z.array(cvSectionSchema),
});
export type CvContent = z.infer<typeof cvContentSchema>;

export const tailorResultSchema = z.object({
  cv: cvContentSchema,
  countryDetection: countryDetectionSchema,
});
export type TailorResult = z.infer<typeof tailorResultSchema>;

export function toCvDocument(content: CvContent, style: CvStyle): CvDocument {
  return { header: content.header, sections: content.sections, style };
}
