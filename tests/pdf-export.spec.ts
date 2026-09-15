import { test, expect } from "@playwright/test";
import { renderCvToPdf } from "@/lib/pdf-render";
import type { CvDocument } from "@/lib/cv-schema";
import { DEFAULT_CV_STYLE } from "@/lib/cv-schema";

const sampleCv: CvDocument = {
  header: {
    name: "Ada Lovelace",
    contactLine: "ada@example.com · London, UK",
  },
  sections: [
    {
      id: "experience",
      heading: "Experience",
      kind: "entries",
      order: 0,
      visible: true,
      entries: [
        {
          id: "entry-1",
          title: "Analytical Engine Programmer",
          subtitle: "Independent",
          dateRange: "1842 – 1843",
          bullets: ["Wrote the first published algorithm for a machine."],
        },
      ],
    },
  ],
  style: DEFAULT_CV_STYLE,
};

// Exercises the real export path used by the app: launch Chromium, navigate
// to /print/cv against the live Next.js server, and produce a PDF — the
// pieces a type check or lint pass can't verify because they only bite at
// runtime (schema round-trip through the URL, browser launch, page.pdf()).
test("renders a CV to a non-empty PDF", async () => {
  const { pdf, contentHeightIn } = await renderCvToPdf(sampleCv);

  expect(pdf.length).toBeGreaterThan(0);
  expect(pdf.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  expect(contentHeightIn).toBeGreaterThan(0);
});
