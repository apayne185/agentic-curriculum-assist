import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import CvDocumentView, { paperDimensionsIn } from "@/components/CvDocument";
import type { CvDocument } from "./cv-schema";

function wrapHtml(bodyMarkup: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ul { margin: 0; }
    </style>
  </head>
  <body>${bodyMarkup}</body>
</html>`;
}

/**
 * Renders the CV to a PDF buffer using the exact same React component and
 * inline styles as the browser preview, so the export is a faithful WYSIWYG
 * match. Also returns the rendered content height in inches (via the same
 * measurement Playwright saw) so callers can detect page overflow.
 */
export async function renderCvToPdf(
  cv: CvDocument,
): Promise<{ pdf: Buffer; contentHeightIn: number }> {
  const markup = renderToStaticMarkup(CvDocumentView({ cv }));
  const html = wrapHtml(markup);
  const dims = paperDimensionsIn(cv.style.paperSize);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const contentHeightIn = await page.evaluate(() => {
      const node = document.querySelector("[data-cv-page]") as HTMLElement | null;
      return (node?.scrollHeight ?? 0) / 96;
    });

    const pdf = await page.pdf({
      width: `${dims.width}in`,
      height: `${dims.height}in`,
      printBackground: true,
      margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
    });

    return { pdf: Buffer.from(pdf), contentHeightIn };
  } finally {
    await browser.close();
  }
}
