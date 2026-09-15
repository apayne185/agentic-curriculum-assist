"use client";

import { useCallback, useState } from "react";
import type { CvDocument, CountryDetection } from "./cv-schema";

export type CvSession = {
  original: CvDocument;
  current: CvDocument;
  countryDetection?: CountryDetection;
  jobDescriptionText: string;
  jobUrl?: string;
  notes?: string;
};

const STORAGE_KEY = "cv-tailor-session-v1";

export function saveSession(session: CvSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be unavailable (private browsing, quota); autosave is
    // best-effort only, so silently skip rather than breaking the app.
  }
}

export function loadSession(): CvSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CvSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Loads the persisted session once (lazily, on first render) and autosaves on every change. */
export function useCvSession() {
  const [session, setSession] = useState<CvSession | null>(() => loadSession());

  const update = useCallback((next: CvSession | null) => {
    setSession(next);
    if (next) saveSession(next);
    else clearSession();
  }, []);

  return { session, setSession: update };
}
