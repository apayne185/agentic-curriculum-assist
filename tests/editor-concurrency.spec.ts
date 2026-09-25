import { test, expect } from "@playwright/test";
import type { CvDocument } from "@/lib/cv-schema";

// Regression test: the editor's autofit and re-tailor handlers both
// read-then-write the session, each from an async operation. Using a plain
// captured-closure setSession(computedValue) meant whichever operation's
// write landed last would silently discard the other's changes. This
// exercises that exact scenario against the real running app.

const baseCv: CvDocument = {
  header: { name: "Jordan Smith", contactLine: "Boston, MA | jordan@example.com" },
  sections: Array.from({ length: 6 }, (_, s) => ({
    id: `sec${s}`,
    heading: `SECTION ${s}`,
    kind: "entries" as const,
    order: s,
    visible: true,
    entries: [
      {
        id: `e${s}`,
        title: "Long Role",
        subtitle: "Big Co",
        bullets: Array.from(
          { length: 15 },
          (_, i) => `Bullet point number ${i} with quite a lot of descriptive detail to take up real vertical space`,
        ),
      },
    ],
  })),
  style: {
    fontFamily: "Georgia",
    fontSizePt: 11,
    lineHeight: 1.15,
    marginIn: { top: 1.0, right: 1.0, bottom: 1.0, left: 1.0 },
    sectionSpacingPt: 12,
    accentColor: "#111111",
    paperSize: "letter",
  },
};

test("a re-tailor that resolves while autofit is still running doesn't clobber autofit's style change", async ({
  page,
}) => {
  const session = { original: baseCv, current: baseCv, jobDescriptionText: "Sample job." };

  // Delay /api/tailor so there's a real window for autofit's multi-pass
  // measurement loop to still be in flight when it resolves.
  await page.route("**/api/tailor", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    const mockCv = JSON.parse(JSON.stringify(baseCv));
    mockCv.header.name = "RETAILORED NAME";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cv: mockCv,
        countryDetection: { paperSize: "letter", confident: true },
      }),
    });
  });

  await page.goto("/");
  await page.evaluate((s) => localStorage.setItem("cv-tailor-session-v1", JSON.stringify(s)), session);
  await page.goto("/editor");
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Fit to one page" }).click();
  await page.waitForTimeout(100);

  await page.getByRole("tab", { name: "Notes" }).click();
  await page.locator("textarea").fill("emphasize leadership");
  await page.getByRole("button", { name: "Apply & re-tailor" }).click();

  await page.waitForTimeout(5000);

  const finalState = await page.evaluate(() => {
    const raw = localStorage.getItem("cv-tailor-session-v1");
    return JSON.parse(raw!).current as CvDocument;
  });

  // Both operations' effects must survive: the re-tailored name, and the
  // autofit's reduced font size (the fixture is long enough to require
  // shrinking below the default 11pt to fit one page).
  expect(finalState.header.name).toBe("RETAILORED NAME");
  expect(finalState.style.fontSizePt).toBeLessThan(11);
});
