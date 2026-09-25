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
import { clampCvStyle, type CvDocument, type CvStyle } from "@/lib/cv-schema";

type Tab = "format" | "edit" | "notes";

export default function EditorPage() {
  const router = useRouter();
  const { session, setSession, updateSession, hydrated } = useCvSession();
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
      // Captures the style to fit at the moment autofit starts. The
      // measurement loop below runs several async passes, during which
      // other edits (a re-tailor, a manual edit) may land — the final
      // write uses the functional updateSession so it merges onto
      // whatever is live *then*, rather than overwriting it with a value
      // computed from this now-stale snapshot.
      const { style, fits } = await autofitToOnePage(cvSession.current.style, (candidateStyle) =>
        measureCvHeightIn(cvSession.current, candidateStyle),
      );
      updateSession((prev) => ({ ...prev, current: { ...prev.current, style } }));
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

  /** Returns whether the re-tailor succeeded, so callers (NotesBox) know
   * whether it's safe to clear what the user typed. */
  async function handleRetailor(notes: string): Promise<boolean> {
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
      // Merges onto whatever session is live when this resolves (see the
      // comment in handleAutofit) rather than the snapshot captured when
      // the request started, so a concurrent autofit/manual style edit
      // isn't lost.
      updateSession((prev) => {
        // Re-tailoring only ever changes *content*, never formatting — the
        // response's style reflects whatever was live when the request was
        // sent, which may now be stale (e.g. autofit ran while this was in
        // flight). Always keep the live style in full, not just paperSize.
        const tailoredCv: CvDocument = { ...data.cv, style: prev.current.style };
        return { ...prev, current: tailoredCv, countryDetection: data.countryDetection, notes };
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setRetailoring(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      // Defensive clamp in case a format field holds a transiently
      // out-of-range value (e.g. mid-typing, not yet blurred) — the export
      // schema enforces the same bounds and would otherwise fail with an
      // opaque "Invalid cv" error instead of just using a valid value.
      const cvToExport: CvDocument = {
        ...cvSession.current,
        style: clampCvStyle(cvSession.current.style),
      };
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: cvToExport }),
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
        {error && (
          <p role="alert" className="text-sm text-red-600 max-w-md text-center">
            {error}
          </p>
        )}
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
        <div role="tablist" aria-label="Editor sections" className="flex border-b border-zinc-200">
          {(["format", "edit", "notes"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`tabpanel-${t}`}
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
            <div id="tabpanel-format" role="tabpanel" aria-labelledby="tab-format">
              <FormatPanel
                style={cvSession.current.style}
                onChange={updateStyle}
                onAutofit={handleAutofit}
                autofitting={autofitting}
                overflowing={overflowing}
              />
            </div>
          )}
          {tab === "edit" && (
            <div id="tabpanel-edit" role="tabpanel" aria-labelledby="tab-edit">
              <SectionEditor cv={cvSession.current} onChange={updateCv} />
            </div>
          )}
          {tab === "notes" && (
            <div id="tabpanel-notes" role="tabpanel" aria-labelledby="tab-notes">
              <NotesBox onRetailor={handleRetailor} busy={retailoring} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
