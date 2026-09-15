import type { CvStyle } from "./cv-schema";
import { paperDimensionsIn } from "@/components/CvDocument";

// Descending ladder of (fontSize, lineHeight, margin) combinations, tried in
// order until the rendered content fits one page. Never goes below a
// readability floor (9.5pt / 0.4in margins).
const AUTOFIT_LADDER: Array<{
  fontSizePt: number;
  lineHeight: number;
  marginIn: number;
  sectionSpacingPt: number;
}> = [
  { fontSizePt: 11, lineHeight: 1.15, marginIn: 1.0, sectionSpacingPt: 12 },
  { fontSizePt: 10.5, lineHeight: 1.15, marginIn: 0.85, sectionSpacingPt: 10 },
  { fontSizePt: 10.5, lineHeight: 1.1, marginIn: 0.75, sectionSpacingPt: 9 },
  { fontSizePt: 10, lineHeight: 1.1, marginIn: 0.65, sectionSpacingPt: 8 },
  { fontSizePt: 10, lineHeight: 1.05, marginIn: 0.55, sectionSpacingPt: 7 },
  { fontSizePt: 9.5, lineHeight: 1.0, marginIn: 0.5, sectionSpacingPt: 6 },
  { fontSizePt: 9.5, lineHeight: 1.0, marginIn: 0.4, sectionSpacingPt: 5 },
];

export function styleFromLadderStep(
  base: CvStyle,
  step: (typeof AUTOFIT_LADDER)[number],
): CvStyle {
  return {
    ...base,
    fontSizePt: step.fontSizePt,
    lineHeight: step.lineHeight,
    sectionSpacingPt: step.sectionSpacingPt,
    marginIn: {
      top: step.marginIn,
      right: step.marginIn,
      bottom: step.marginIn,
      left: step.marginIn,
    },
  };
}

/** Printable page height in inches for the given style's paper size and margins. */
export function printableHeightIn(style: CvStyle): number {
  const { height } = paperDimensionsIn(style.paperSize);
  return height - style.marginIn.top - style.marginIn.bottom;
}

/**
 * Tries each ladder step in order, using `measureHeightIn` (which renders the
 * CV with the given style and returns the content height in inches) to find
 * the first step whose content fits one page. Falls back to the tightest
 * step if nothing fits, so the caller can warn the user to trim content.
 */
export async function autofitToOnePage(
  base: CvStyle,
  measureHeightIn: (style: CvStyle) => Promise<number>,
): Promise<{ style: CvStyle; fits: boolean }> {
  let lastStyle = base;
  for (const step of AUTOFIT_LADDER) {
    const style = styleFromLadderStep(base, step);
    lastStyle = style;
    const contentHeight = await measureHeightIn(style);
    if (contentHeight <= printableHeightIn(style)) {
      return { style, fits: true };
    }
  }
  return { style: lastStyle, fits: false };
}
