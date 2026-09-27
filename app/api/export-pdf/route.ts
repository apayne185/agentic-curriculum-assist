import { NextResponse } from "next/server";
import { cvDocumentSchema } from "@/lib/cv-schema";
import { renderCvToPdf } from "@/lib/pdf-render";
import { pageHeightIn } from "@/lib/autofit";
import { userFacingErrorMessage } from "@/lib/user-facing-error";

export const runtime = "nodejs";
// Launching a browser and rendering a full page adds real latency beyond a
// typical API route; Vercel's Fluid Compute default (300s) is already
// generous for this, but set it explicitly so it's not left implicit.
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = cvDocumentSchema.safeParse(body?.cv);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid 'cv' in request body." }, { status: 400 });
  }

  try {
    const { pdf, contentHeightIn } = await renderCvToPdf(parsed.data);
    const overflowed = contentHeightIn > pageHeightIn(parsed.data.style);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=cv.pdf",
        "X-Cv-Overflowed": String(overflowed),
      },
    });
  } catch (err) {
    const message = userFacingErrorMessage(
      err,
      "Something went wrong while creating your PDF. Please try again in a moment.",
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
