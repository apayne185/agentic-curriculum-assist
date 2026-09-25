import { test, expect } from "@playwright/test";
import type { CvDocument } from "@/lib/cv-schema";
import { DEFAULT_CV_STYLE } from "@/lib/cv-schema";

// Regression test: a section with no content yet (just added via the
// editor, not filled in) used to render as a bare underlined heading with
// nothing under it in both the live preview and the exported PDF.
// CvDocument.tsx's SectionBlock now skips sections with no entries/text.

const cv: CvDocument = {
  header: { name: "Ada Lovelace", contactLine: "ada@example.com" },
  sections: [
    {
      id: "populated",
      heading: "EXPERIENCE",
      kind: "entries",
      order: 0,
      visible: true,
      entries: [{ id: "e1", title: "Engineer", bullets: ["Did a real thing"] }],
    },
    { id: "empty-entries", heading: "EMPTY ENTRIES SECTION", kind: "entries", order: 1, visible: true },
    {
      id: "empty-entries-array",
      heading: "EMPTY ARRAY SECTION",
      kind: "entries",
      order: 2,
      visible: true,
      entries: [],
    },
    { id: "empty-skills", heading: "EMPTY SKILLS SECTION", kind: "skills", order: 3, visible: true, skillsLine: "" },
    {
      id: "whitespace-skills",
      heading: "WHITESPACE SKILLS SECTION",
      kind: "skills",
      order: 4,
      visible: true,
      skillsLine: "   ",
    },
    {
      id: "empty-freeform",
      heading: "EMPTY FREEFORM SECTION",
      kind: "freeform",
      order: 5,
      visible: true,
      freeformText: "",
    },
    {
      id: "populated-skills",
      heading: "SKILLS",
      kind: "skills",
      order: 6,
      visible: true,
      skillsLine: "Python, SQL",
    },
  ],
  style: DEFAULT_CV_STYLE,
};

test("empty sections don't render, populated sections do", async ({ page }) => {
  const data = Buffer.from(JSON.stringify(cv), "utf-8").toString("base64url");
  await page.goto(`/print/cv?data=${data}`);

  const bodyText = await page.textContent("body");

  expect(bodyText).toContain("EXPERIENCE");
  expect(bodyText).toContain("SKILLS");
  expect(bodyText).toContain("Python, SQL");

  expect(bodyText).not.toContain("EMPTY ENTRIES SECTION");
  expect(bodyText).not.toContain("EMPTY ARRAY SECTION");
  expect(bodyText).not.toContain("EMPTY SKILLS SECTION");
  expect(bodyText).not.toContain("WHITESPACE SKILLS SECTION");
  expect(bodyText).not.toContain("EMPTY FREEFORM SECTION");
});
