"use client";

import { useCallback, useEffect, useState } from "react";
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

/**
 * Loads the persisted session after mount (never during the initial render,
 * so the client's first pass matches the server's and React doesn't flag a
 * hydration mismatch) and autosaves on every change. `hydrated` lets callers
 * distinguish "still loading" from "genuinely no session".
 */
export function useCvSession() {
  const [session, setSession] = useState<CvSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage can only happen client-side, so this must be an
    // effect rather than a lazy useState initializer (which would run
    // during the initial client render and cause a hydration mismatch
    // against the server's render, which has no access to localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(loadSession());
    setHydrated(true);
  }, []);

  const update = useCallback((next: CvSession | null) => {
    setSession(next);
    if (next) saveSession(next);
    else clearSession();
  }, []);

  /**
   * Functional update: `updater` receives the *latest* session (not a
   * value captured in a stale closure) and returns the next one. Use this
   * from any async operation (autofit, re-tailor) that reads-then-writes
   * the session, so two such operations resolving out of order can't
   * silently clobber each other's changes — each always merges onto
   * whatever the other most recently committed.
   */
  const updateFn = useCallback((updater: (prev: CvSession) => CvSession) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveSession(next);
      return next;
    });
  }, []);

  return { session, setSession: update, updateSession: updateFn, hydrated };
}
