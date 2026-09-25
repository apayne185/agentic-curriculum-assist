/**
 * Picks the message an API route should send back to the client for a
 * caught error. Errors that carry a `userMessage` property (e.g.
 * LlmNotConfiguredError / LlmProviderError in lib/llm/types.ts, or any
 * other error type written the same way) are shown as-is to whoever is
 * using the app; everything else falls back to a generic message, since a
 * raw `err.message` can contain environment variable names, file paths, or
 * other internal detail that means nothing to a non-technical user. The
 * full technical detail is always logged server-side via `console.error`
 * before this returns, regardless of which message gets shown.
 */
export function userFacingErrorMessage(err: unknown, fallback: string): string {
  console.error(err);
  if (err instanceof Error && "userMessage" in err && typeof err.userMessage === "string") {
    return err.userMessage;
  }
  return fallback;
}
