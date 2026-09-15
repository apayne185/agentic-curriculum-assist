import { NextResponse } from "next/server";
import { tailorCv } from "@/lib/claude";
import { cvDocumentSchema, toCvDocument } from "@/lib/cv-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsedCv = cvDocumentSchema.safeParse(body.cv);
  if (!parsedCv.success) {
    return NextResponse.json({ error: "Invalid 'cv' in request body." }, { status: 400 });
  }

  const jobDescriptionText =
    typeof body.jobDescriptionText === "string" ? body.jobDescriptionText.trim() : "";
  if (!jobDescriptionText) {
    return NextResponse.json({ error: "Missing 'jobDescriptionText'." }, { status: 400 });
  }

  const jobUrl = typeof body.jobUrl === "string" ? body.jobUrl.trim() || undefined : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim() || undefined : undefined;

  try {
    const { cv: tailoredContent, countryDetection } = await tailorCv({
      currentCv: parsedCv.data,
      jobDescriptionText,
      jobUrl,
      notes,
    });

    const style = { ...parsedCv.data.style };
    if (countryDetection.confident) {
      style.paperSize = countryDetection.paperSize;
    }

    const cv = toCvDocument(tailoredContent, style);
    return NextResponse.json({ cv, countryDetection });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to tailor CV.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
