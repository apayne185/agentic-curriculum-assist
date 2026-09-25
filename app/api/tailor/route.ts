import { NextResponse } from "next/server";
import { tailorCv } from "@/lib/llm";
import { userFacingErrorMessage } from "@/lib/llm/user-facing-error";
import { cvDocumentSchema, toCvDocument } from "@/lib/cv-schema";

export const runtime = "nodejs";

const MAX_JOB_TEXT_CHARS = 20_000;
const MAX_NOTES_CHARS = 4_000;

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
  if (jobDescriptionText.length > MAX_JOB_TEXT_CHARS) {
    return NextResponse.json(
      { error: "That job description is too long. Please paste a shorter excerpt." },
      { status: 400 },
    );
  }

  const jobUrl = typeof body.jobUrl === "string" ? body.jobUrl.trim() || undefined : undefined;
  let notes = typeof body.notes === "string" ? body.notes.trim() || undefined : undefined;
  if (notes && notes.length > MAX_NOTES_CHARS) {
    notes = notes.slice(0, MAX_NOTES_CHARS);
  }

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
    const message = userFacingErrorMessage(
      err,
      "Something went wrong while tailoring your CV. Please try again in a moment.",
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
