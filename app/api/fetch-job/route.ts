import { NextResponse } from "next/server";
import { safeFetch } from "@/lib/safe-fetch";
import { htmlToText } from "@/lib/html-to-text";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!url) {
    return NextResponse.json({ error: "Missing 'url'." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await safeFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CvTailorBot/1.0; +personal-use-job-fetch)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch that URL.";
    return NextResponse.json({ error: message, fallbackToPaste: true }, { status: 400 });
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error: `The job page returned an error (HTTP ${response.status}). Please paste the description instead.`,
        fallbackToPaste: true,
      },
      { status: 400 },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    return NextResponse.json(
      {
        error: "That URL didn't return a readable page. Please paste the description instead.",
        fallbackToPaste: true,
      },
      { status: 400 },
    );
  }

  const html = await response.text();
  const text = htmlToText(html);

  if (text.length < 100) {
    return NextResponse.json(
      {
        error:
          "Couldn't extract enough text from that page (it may require JavaScript). Please paste the description instead.",
        fallbackToPaste: true,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ text, sourceUrl: url });
}
