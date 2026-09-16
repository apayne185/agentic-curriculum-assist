import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { extractCvFromText } from "@/lib/claude";
import { DEFAULT_CV_STYLE, toCvDocument } from "@/lib/cv-schema";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — generous for a text CV, cheap to reject earlier
const MAX_EXTRACTED_CHARS = 50_000; // ~well beyond any real CV; guards against pathological PDFs

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a 'cv' file." }, { status: 400 });
  }

  const file = formData.get("cv");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'cv' file in form data." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "That PDF is too large (max 10MB). Please upload a smaller file." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // PDFs start with the "%PDF-" magic bytes; catches non-PDF uploads early
  // (the browser's accept="application/pdf" is trivially bypassable).
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return NextResponse.json({ error: "That file doesn't look like a PDF." }, { status: 400 });
  }

  let rawText: string;
  try {
    rawText = await extractTextFromPdf(buffer);
  } catch (err) {
    console.error("PDF text extraction failed:", err);
    return NextResponse.json(
      { error: "Could not read that PDF. Please make sure it's a valid, non-scanned PDF." },
      { status: 400 },
    );
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      { error: "No text found in the PDF. If it's a scanned image, text extraction isn't supported yet." },
      { status: 400 },
    );
  }

  if (rawText.length > MAX_EXTRACTED_CHARS) {
    rawText = rawText.slice(0, MAX_EXTRACTED_CHARS);
  }

  try {
    const content = await extractCvFromText(rawText);
    const cv = toCvDocument(content, DEFAULT_CV_STYLE);
    return NextResponse.json({ cv });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse CV.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
