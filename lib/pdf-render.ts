import { chromium } from "playwright";
import { paperDimensionsIn } from "@/components/CvDocument";
import type { CvDocument } from "./cv-schema";

function baseUrl(): string {
  // In dev/prod this process is the same Next.js server handling the
  // request, so it's always reachable on its own port over loopback.
  const port = process.env.PORT ?? "3000";
  return process.env.INTERNAL_BASE_URL ?? `http://localhost:${port}`;
}

/**
 * Renders the CV to a PDF buffer by having Playwright navigate to the app's
 * own /print/cv page (the same CvDocumentView component used for the live
 * preview, rendered through Next.js normally), so the export is a faithful
 * WYSIWYG match with no separate HTML-templating path to keep in sync.
 */
export async function renderCvToPdf(
  cv: CvDocument,
): Promise<{ pdf: Buffer; contentHeightIn: number }> {
  const dims = paperDimensionsIn(cv.style.paperSize);
  const data = Buffer.from(JSON.stringify(cv), "utf-8").toString("base64url");
  const url = `${baseUrl()}/print/cv?data=${data}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: "load" });
    if (!response || !response.ok()) {
      throw new Error("Could not render the CV for export.");
    }

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
