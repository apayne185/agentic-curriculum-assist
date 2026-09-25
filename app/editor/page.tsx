"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CvDocumentView, { paperDimensionsIn } from "@/components/CvDocument";
import FormatPanel from "@/components/FormatPanel";
import SectionEditor from "@/components/SectionEditor";
import NotesBox from "@/components/NotesBox";
import { useCvSession } from "@/lib/cv-store";
import { autofitToOnePage, pageHeightIn } from "@/lib/autofit";
import { measureCvHeightIn } from "@/lib/measure-cv-height";
import type { CvDocument, CvStyle } from "@/lib/cv-schema";

type Tab = "format" | "edit" | "notes";

export default function EditorPage() {
  const router = useRouter();
  const { session, setSession, hydrated } = useCvSession();
  const [tab, setTab] = useState<Tab>("format");
  const [overflowing, setOverflowing] = useState<boolean | null>(null);
  const [autofitting, setAutofitting] = useState(false);
  const [retailoring, setRetailoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hydrated && !session) {
      router.replace("/");
    }
  }, [hydrated, session, router]);

  useEffect(() => {
    if (!session) return;
    const node = previewRef.current?.querySelector<HTMLElement>("[data-cv-page]");
    if (!node) return;
    const pageHeightPx = pageHeightIn(session.current.style) * 96;
    setOverflowing(node.scrollHeight > pageHeightPx);
  }, [session]);

  if (!session) {
    return (
      <main className="flex items-center justify-center h-screen text-sm text-zinc-500">
        Loading…
      </main>
    );
  }

  const cvSession = session;

  function updateCv(next: CvDocument) {
    setSession({ ...cvSession, current: next });
  }

  function updateStyle(style: CvStyle) {
    updateCv({ ...cvSession.current, style });
  }

  async function handleAutofit() {
    setAutofitting(true);
    try {
      const { style, fits } = await autofitToOnePage(cvSession.current.style, (candidateStyle) =>
        measureCvHeightIn(cvSession.current, candidateStyle),
      );
      updateStyle(style);
      setOverflowing(!fits);
      if (!fits) {
        setError(
          "Even at the tightest readable settings, this CV doesn't fit one page. Try trimming some content.",
        );
      } else {
        setError(null);
      }
    } finally {
      setAutofitting(false);
    }
  }

  async function handleRetailor(notes: string) {
    setRetailoring(true);
    setError(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv: cvSession.current,
          jobDescriptionText: cvSession.jobDescriptionText,
          jobUrl: cvSession.jobUrl,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to re-tailor.");
      // Paper size is a formatting choice the user already made (via the
      // intake flow's country step, or the Format panel) — re-tailoring
      // content on a note shouldn't silently change it as a side effect,
      // even if the model's detection now disagrees with what's already set.
      const tailoredCv: CvDocument = {
        ...data.cv,
        style: { ...data.cv.style, paperSize: cvSession.current.style.paperSize },
      };
      setSession({
        ...cvSession,
        current: tailoredCv,
        countryDetection: data.countryDetection,
        notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRetailoring(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: cvSession.current }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to export PDF.");
      }
      if (res.headers.get("X-Cv-Overflowed") === "true") {
        setError(
          "Warning: the exported PDF spans more than one page. Try \"Fit to one page\" or trim some content.",
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cvSession.current.header.name || "cv"}.pdf`.replace(/\s+/g, "_");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setExporting(false);
    }
  }

  const dims = paperDimensionsIn(cvSession.current.style.paperSize);

  return (
    <div className="flex h-screen">
      <main className="flex-1 overflow-auto bg-zinc-100 flex flex-col items-center py-10 gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm text-zinc-600 underline"
          >
            ← Start over
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-40"
          >
            {exporting ? "Exporting…" : "Download PDF"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 max-w-md text-center">{error}</p>}
        <div
          ref={previewRef}
          style={{
            width: `${dims.width}in`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          <CvDocumentView cv={cvSession.current} />
        </div>
      </main>

      <aside className="w-80 border-l border-zinc-200 flex flex-col">
        <div className="flex border-b border-zinc-200">
          {(["format", "edit", "notes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm capitalize ${
                tab === t ? "border-b-2 border-black font-medium" : "text-zinc-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {tab === "format" && (
            <FormatPanel
              style={cvSession.current.style}
              onChange={updateStyle}
              onAutofit={handleAutofit}
              autofitting={autofitting}
              overflowing={overflowing}
            />
          )}
          {tab === "edit" && <SectionEditor cv={cvSession.current} onChange={updateCv} />}
          {tab === "notes" && <NotesBox onRetailor={handleRetailor} busy={retailoring} />}
        </div>
      </aside>
    </div>
  );
}
