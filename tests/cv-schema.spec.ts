import { test, expect } from "@playwright/test";
import {
  clampCvStyle,
  cvDocumentSchema,
  cvStyleSchema,
  DEFAULT_CV_STYLE,
  paperSizeForCountry,
  toCvDocument,
  type CvContent,
} from "@/lib/cv-schema";

const validCv = {
  header: { name: "Ada Lovelace", contactLine: "ada@example.com" },
  sections: [
    {
      id: "s1",
      heading: "EXPERIENCE",
      kind: "entries" as const,
      order: 0,
      visible: true,
      entries: [{ id: "e1", title: "Engineer", bullets: ["Did a thing"] }],
    },
  ],
  style: DEFAULT_CV_STYLE,
};

test.describe("cvDocumentSchema", () => {
  test("accepts a well-formed document", () => {
    const result = cvDocumentSchema.safeParse(validCv);
    expect(result.success).toBe(true);
  });

  test("rejects a document missing a required header field", () => {
    const bad = { ...validCv, header: { contactLine: "ada@example.com" } };
    const result = cvDocumentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("rejects an unknown section 'kind'", () => {
    const bad = {
      ...validCv,
      sections: [{ ...validCv.sections[0], kind: "not-a-real-kind" }],
    };
    const result = cvDocumentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("defaults 'visible' to true and 'bullets' to an empty array when omitted", () => {
    const minimal = {
      header: { name: "A", contactLine: "b@example.com" },
      sections: [
        {
          id: "s1",
          heading: "SKILLS",
          kind: "skills" as const,
          order: 0,
          skillsLine: "Excel",
        },
      ],
      style: {},
    };
    const result = cvDocumentSchema.parse(minimal);
    expect(result.sections[0].visible).toBe(true);
    expect(result.style).toEqual(DEFAULT_CV_STYLE);
  });
});

test.describe("cvStyleSchema bounds", () => {
  test("rejects a font size below the readability floor", () => {
    const result = cvStyleSchema.safeParse({ fontSizePt: 5 });
    expect(result.success).toBe(false);
  });

  test("rejects a margin below the allowed minimum", () => {
    const result = cvStyleSchema.safeParse({
      marginIn: { top: 0.1, right: 0.75, bottom: 0.75, left: 0.75 },
    });
    expect(result.success).toBe(false);
  });

  test("rejects an unsupported font family", () => {
    const result = cvStyleSchema.safeParse({ fontFamily: "Comic Sans" });
    expect(result.success).toBe(false);
  });

  test("accepts values at the exact boundary (min/max inclusive)", () => {
    const result = cvStyleSchema.safeParse({ fontSizePt: 8, lineHeight: 1.5 });
    expect(result.success).toBe(true);
  });
});

test.describe("toCvDocument", () => {
  test("combines extracted content with a style into a full CvDocument", () => {
    const content: CvContent = { header: validCv.header, sections: validCv.sections };
    const doc = toCvDocument(content, DEFAULT_CV_STYLE);
    expect(doc.header).toEqual(content.header);
    expect(doc.sections).toEqual(content.sections);
    expect(doc.style).toEqual(DEFAULT_CV_STYLE);
  });
});

test.describe("paperSizeForCountry", () => {
  test("returns 'letter' for the United States and Canada", () => {
    expect(paperSizeForCountry("United States")).toBe("letter");
    expect(paperSizeForCountry("Canada")).toBe("letter");
  });

  test("returns 'a4' for every other country", () => {
    expect(paperSizeForCountry("United Kingdom")).toBe("a4");
    expect(paperSizeForCountry("Ireland")).toBe("a4");
    expect(paperSizeForCountry("Germany")).toBe("a4");
    expect(paperSizeForCountry("India")).toBe("a4");
  });

  test("returns 'a4' for an unrecognized country rather than throwing", () => {
    expect(paperSizeForCountry("Not A Real Country")).toBe("a4");
  });
});

test.describe("clampCvStyle", () => {
  test("clamps a font size above the max down to the max", () => {
    const result = clampCvStyle({ ...DEFAULT_CV_STYLE, fontSizePt: 50 });
    expect(result.fontSizePt).toBe(13);
  });

  test("clamps a font size below the min up to the min", () => {
    const result = clampCvStyle({ ...DEFAULT_CV_STYLE, fontSizePt: 1 });
    expect(result.fontSizePt).toBe(8);
  });

  test("clamps each margin side independently", () => {
    const result = clampCvStyle({
      ...DEFAULT_CV_STYLE,
      marginIn: { top: 5, right: 0, bottom: 0.75, left: -1 },
    });
    expect(result.marginIn).toEqual({ top: 1.5, right: 0.3, bottom: 0.75, left: 0.3 });
  });

  test("leaves already-valid values unchanged", () => {
    const result = clampCvStyle(DEFAULT_CV_STYLE);
    expect(result).toEqual(DEFAULT_CV_STYLE);
  });

  test("treats NaN/non-finite as the minimum rather than throwing", () => {
    const result = clampCvStyle({ ...DEFAULT_CV_STYLE, fontSizePt: NaN });
    expect(result.fontSizePt).toBe(8);
  });

  test("the clamped result always passes cvStyleSchema", () => {
    const wild = clampCvStyle({
      ...DEFAULT_CV_STYLE,
      fontSizePt: 999,
      lineHeight: -5,
      sectionSpacingPt: 0,
      marginIn: { top: 100, right: -100, bottom: NaN, left: 0 },
    });
    expect(cvStyleSchema.safeParse(wild).success).toBe(true);
  });
});
