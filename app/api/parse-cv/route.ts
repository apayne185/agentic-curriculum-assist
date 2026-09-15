import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { extractCvFromText } from "@/lib/claude";
import { DEFAULT_CV_STYLE, toCvDocument } from "@/lib/cv-schema";

export const runtime = "nodejs";

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

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let rawText: string;
  try {
    rawText = await extractTextFromPdf(buffer);
  } catch {
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

  try {
    const content = await extractCvFromText(rawText);
    const cv = toCvDocument(content, DEFAULT_CV_STYLE);
    return NextResponse.json({ cv });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse CV.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
