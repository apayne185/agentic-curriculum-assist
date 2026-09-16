import { test, expect } from "@playwright/test";
import { chromium } from "playwright";

// Regression test: pdf-parse (via pdfjs-dist) tries to load a worker script
// as a runtime file path. Bundling that path (as Next.js does by default
// for Route Handler dependencies) breaks the resolution unless pdf-parse
// and pdfjs-dist are marked as serverExternalPackages in next.config.ts.
// This only fails inside the actual Next.js server runtime, not a plain
// Node process, so the request must go through the real running server
// (via `request`, Playwright's HTTP client hitting baseURL) rather than
// calling extractTextFromPdf() directly in-process.
test("POST /api/parse-cv reads a real PDF without a worker-resolution error", async ({
  request,
}) => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<h1>Test Resume</h1><p>Some content for extraction.</p>");
  const pdfBuffer = await page.pdf();
  await browser.close();

  const response = await request.post("/api/parse-cv", {
    multipart: {
      cv: {
        name: "resume.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      },
    },
  });

  // With no ANTHROPIC_API_KEY configured for the test run, extraction still
  // succeeds and the request fails later at the Claude call (500) rather
  // than at PDF parsing (400) — that boundary is exactly what this test
  // pins down. If the worker bug regresses, this comes back 400 instead.
  const body = await response.json();
  expect(response.status()).not.toBe(400);
  expect(body.error).not.toMatch(/Could not read that PDF/);
});
