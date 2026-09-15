import { randomUUID } from "crypto";
import type { CvDocument } from "./cv-schema";

// Short-lived, in-memory hand-off between the export-pdf route and the
// /print/cv page it asks Playwright to load: the PDF export never has a
// public URL for a given CV, so we stash it under a one-time token instead
// of serializing the whole document into the URL's query string.
const store = new Map<string, { cv: CvDocument; expiresAt: number }>();
const TTL_MS = 60_000;

function sweepExpired() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (entry.expiresAt < now) store.delete(token);
  }
}

export function putForPrint(cv: CvDocument): string {
  sweepExpired();
  const token = randomUUID();
  store.set(token, { cv, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function takeForPrint(token: string): CvDocument | null {
  const entry = store.get(token);
  if (!entry) return null;
  store.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry.cv;
}
