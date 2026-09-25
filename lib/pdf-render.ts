import type { Browser } from "playwright-core";
import { paperDimensionsIn } from "@/components/CvDocument";
import type { CvDocument } from "./cv-schema";

function baseUrl(): string {
  // On Vercel, each function invocation is its own isolated instance with
  // no guaranteed same-process server to reach over loopback — VERCEL_URL
  // is the platform-provided way to get this deployment's own reachable
  // URL. Elsewhere (dev, VPS, Docker) this process IS the Next.js server
  // handling the request, so localhost:PORT always works.
  if (process.env.INTERNAL_BASE_URL) return process.env.INTERNAL_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

/**
 * Launches Chromium via full Playwright locally/on a traditional server
 * (dev, VPS, Docker — anywhere `npx playwright install chromium` has run),
 * or via playwright-core + @sparticuz/chromium on Vercel, whose serverless
 * functions can't rely on a pre-installed browser and need one packaged
 * for that environment instead. Both dependencies are dynamically
 * imported so neither is loaded (or needs to be installed) in the
 * environment that doesn't use it.
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const { chromium } = await import("playwright-core");
    const chromiumBinary = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch();
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

  const browser = await launchBrowser();
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
