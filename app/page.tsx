"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveSession } from "@/lib/cv-store";
import { paperSizeForCountry, type CvDocument, type CountryDetection } from "@/lib/cv-schema";

type Stage =
  | "idle"
  | "reading-cv"
  | "fetching-job"
  | "tailoring"
  | "need-country"
  | "error";

const COMMON_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Ireland",
  "Germany",
  "France",
  "Spain",
  "Netherlands",
  "Australia",
  "India",
];

export default function IntakePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [notes, setNotes] = useState("");
  const [showPasteBox, setShowPasteBox] = useState(false);

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingCountry, setPendingCountry] = useState("");

  // Held between "need-country" and final submission so we don't re-fetch.
  const [pendingParsedCv, setPendingParsedCv] = useState<CvDocument | null>(null);
  const [pendingJobText, setPendingJobText] = useState("");

  const busy = stage === "reading-cv" || stage === "fetching-job" || stage === "tailoring";

  async function resolveJobText(): Promise<string> {
    if (jobUrl.trim()) {
      setStage("fetching-job");
      const res = await fetch("/api/fetch-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) return data.text as string;

      // URL fetch failed — fall back to pasted text if present, otherwise
      // surface the error and ask the user to paste it.
      if (jobText.trim()) return jobText.trim();
      setShowPasteBox(true);
      throw new Error(data.error ?? "Could not fetch the job URL. Please paste the description below.");
    }
    if (jobText.trim()) return jobText.trim();
    throw new Error("Please provide a job posting URL or paste the job description.");
  }

  async function runTailoring(cv: CvDocument, jobDescriptionText: string, countryOverride?: string) {
    setStage("tailoring");
    const res = await fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv,
        jobDescriptionText: countryOverride
          ? `${jobDescriptionText}\n\n(Applicant-confirmed target country: ${countryOverride})`
          : jobDescriptionText,
        jobUrl: jobUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to tailor CV.");

    let tailoredCv = data.cv as CvDocument;
    let countryDetection = data.countryDetection as CountryDetection;

    if (!countryDetection.confident && !countryOverride) {
      setPendingParsedCv(cv);
      setPendingJobText(jobDescriptionText);
      setStage("need-country");
      return;
    }

    // An explicit user-confirmed country is authoritative — never let the
    // model's own inference on this call (which could reasonably disagree,
    // e.g. still detecting the job posting's original location) override
    // what the user just picked.
    if (countryOverride) {
      const paperSize = paperSizeForCountry(countryOverride);
      tailoredCv = { ...tailoredCv, style: { ...tailoredCv.style, paperSize } };
      countryDetection = { countryGuess: countryOverride, paperSize, confident: true };
    }

    saveSession({
      original: cv,
      current: tailoredCv,
      countryDetection,
      jobDescriptionText,
      jobUrl: jobUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    router.push("/editor");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!cvFile) {
      setError("Please upload your CV as a PDF.");
      return;
    }

    try {
      setStage("reading-cv");
      const formData = new FormData();
      formData.append("cv", cvFile);
      const parseRes = await fetch("/api/parse-cv", { method: "POST", body: formData });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error ?? "Failed to read CV.");
      const parsedCv = parseData.cv as CvDocument;

      const resolvedJobText = await resolveJobText();
      await runTailoring(parsedCv, resolvedJobText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }

  async function handleConfirmCountry() {
    if (!pendingParsedCv || !pendingCountry) return;
    setError(null);
    try {
      await runTailoring(pendingParsedCv, pendingJobText, pendingCountry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }

  if (stage === "need-country") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 id="country-question" className="text-xl font-semibold mb-2">
          Which country is this job in?
        </h1>
        <p className="text-sm text-zinc-600 mb-6">
          We couldn&apos;t confidently tell from the job posting, and this affects the CV&apos;s
          paper size and formatting conventions.
        </p>
        <select
          aria-labelledby="country-question"
          className="w-full border border-zinc-300 rounded px-3 py-2 mb-4"
          value={pendingCountry}
          onChange={(e) => setPendingCountry(e.target.value)}
        >
          <option value="">Select a country…</option>
          {COMMON_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-40"
          disabled={!pendingCountry || busy}
          onClick={handleConfirmCountry}
        >
          {busy ? "Tailoring…" : "Continue"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600 mt-3">
            {error}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold mb-1">CV Tailor</h1>
      <p className="text-sm text-zinc-600 mb-8">
        Upload your CV and a job posting, and get a tailored, one-page, Harvard-style CV you can
        preview and refine.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label htmlFor="cv-file" className="block font-medium mb-2">
            Your CV (PDF)
          </label>
          <input
            id="cv-file"
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm border border-zinc-300 rounded px-3 py-2"
          />
          {cvFile && <p className="text-xs text-zinc-500 mt-1">{cvFile.name}</p>}
        </div>

        <div>
          <label htmlFor="job-url" className="block font-medium mb-2">
            Job posting URL
          </label>
          <input
            id="job-url"
            type="url"
            placeholder="https://company.com/careers/role"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            className="w-full border border-zinc-300 rounded px-3 py-2"
          />
          <button
            type="button"
            aria-expanded={showPasteBox}
            aria-controls="job-text"
            onClick={() => setShowPasteBox((v) => !v)}
            className="text-sm text-zinc-600 underline mt-2"
          >
            {showPasteBox ? "Hide paste box" : "Or paste the job description instead"}
          </button>
          {showPasteBox && (
            <textarea
              id="job-text"
              aria-label="Job description"
              placeholder="Paste the job description here…"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={8}
              className="w-full border border-zinc-300 rounded px-3 py-2 mt-2"
            />
          )}
        </div>

        <div>
          <label htmlFor="notes" className="block font-medium mb-2">
            Additional notes (optional)
          </label>
          <textarea
            id="notes"
            placeholder="e.g. I'm applying as a career switcher, emphasize leadership, keep it to bullet points only…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-zinc-300 rounded px-3 py-2"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-black text-white rounded px-4 py-3 font-medium disabled:opacity-40"
        >
          {stage === "reading-cv" && "Reading your CV…"}
          {stage === "fetching-job" && "Fetching job posting…"}
          {stage === "tailoring" && "Tailoring your CV…"}
          {!busy && "Tailor my CV"}
        </button>
      </form>
    </main>
  );
}
