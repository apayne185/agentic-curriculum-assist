import { NextResponse } from "next/server";
import { cvDocumentSchema } from "@/lib/cv-schema";
import { renderCvToPdf } from "@/lib/pdf-render";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = cvDocumentSchema.safeParse(body?.cv);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid 'cv' in request body." }, { status: 400 });
  }

  try {
    const { pdf } = await renderCvToPdf(parsed.data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=cv.pdf",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
