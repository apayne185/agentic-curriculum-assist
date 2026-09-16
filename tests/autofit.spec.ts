import { test, expect } from "@playwright/test";
import { autofitToOnePage, pageHeightIn, styleFromLadderStep } from "@/lib/autofit";
import { DEFAULT_CV_STYLE } from "@/lib/cv-schema";

test.describe("pageHeightIn", () => {
  test("returns full US Letter height for letter paper size", () => {
    expect(pageHeightIn({ ...DEFAULT_CV_STYLE, paperSize: "letter" })).toBe(11);
  });

  test("returns full A4 height for a4 paper size", () => {
    expect(pageHeightIn({ ...DEFAULT_CV_STYLE, paperSize: "a4" })).toBeCloseTo(11.69, 2);
  });
});

test.describe("autofitToOnePage", () => {
  test("returns the first (loosest) step whose measured height fits the page", async () => {
    // Fits as soon as font size drops to 10.5pt (the third ladder step) —
    // measureHeightIn reports a height that only clears the 11in page once
    // the style has shrunk enough.
    const { style, fits } = await autofitToOnePage(DEFAULT_CV_STYLE, async (style) => {
      return style.fontSizePt <= 10.5 ? 10 : 13;
    });
    expect(fits).toBe(true);
    expect(style.fontSizePt).toBe(10.5);
  });

  test("does not shrink further than necessary", async () => {
    // Already fits at the very first (loosest) ladder step.
    const { style, fits } = await autofitToOnePage(DEFAULT_CV_STYLE, async () => 5);
    expect(fits).toBe(true);
    expect(style.fontSizePt).toBe(11);
    expect(style.marginIn.top).toBe(1.0);
  });

  test("falls back to the tightest step and reports fits:false when nothing fits", async () => {
    const { style, fits } = await autofitToOnePage(DEFAULT_CV_STYLE, async () => 100);
    expect(fits).toBe(false);
    // Tightest step in the ladder.
    expect(style.fontSizePt).toBe(9.5);
    expect(style.marginIn.top).toBe(0.4);
  });

  test("never produces margins below the 0.4in readability floor", async () => {
    const { style } = await autofitToOnePage(DEFAULT_CV_STYLE, async () => 100);
    expect(style.marginIn.top).toBeGreaterThanOrEqual(0.4);
    expect(style.marginIn.right).toBeGreaterThanOrEqual(0.4);
    expect(style.marginIn.bottom).toBeGreaterThanOrEqual(0.4);
    expect(style.marginIn.left).toBeGreaterThanOrEqual(0.4);
  });
});

test.describe("styleFromLadderStep", () => {
  test("applies uniform margins on all four sides", () => {
    const style = styleFromLadderStep(DEFAULT_CV_STYLE, {
      fontSizePt: 10,
      lineHeight: 1.1,
      marginIn: 0.6,
      sectionSpacingPt: 8,
    });
    expect(style.marginIn).toEqual({ top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 });
  });

  test("preserves fields not controlled by the ladder (e.g. fontFamily, paperSize)", () => {
    const base = { ...DEFAULT_CV_STYLE, fontFamily: "Garamond" as const, paperSize: "a4" as const };
    const style = styleFromLadderStep(base, {
      fontSizePt: 10,
      lineHeight: 1.1,
      marginIn: 0.6,
      sectionSpacingPt: 8,
    });
    expect(style.fontFamily).toBe("Garamond");
    expect(style.paperSize).toBe("a4");
  });
});
