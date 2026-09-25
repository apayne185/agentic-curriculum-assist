import type { z } from "zod";

export type StructuredToolCall<T> = {
  /** System prompt / instructions for the model. */
  system: string;
  /** The user-turn content (CV JSON, job description, notes, etc). */
  userContent: string;
  /** Name of the "tool" the model should call to return its answer. */
  toolName: string;
  /** Description of what the tool call is for. */
  toolDescription: string;
  /** Schema the tool call's input must satisfy; also used to validate the result. */
  schema: z.ZodType<T>;
};

/**
 * A pluggable LLM backend. Each provider is responsible for getting the
 * model to return JSON matching `schema` by whatever mechanism it supports
 * (tool-calling, JSON mode, function calling, etc) — callers only depend on
 * this interface, never on a provider's SDK directly, so switching the
 * backend (e.g. for a free-tier alternative) doesn't touch the extraction/
 * tailoring prompts or the API routes that call them.
 */
export interface LlmProvider {
  readonly name: string;
  runStructuredTool<T>(call: StructuredToolCall<T>): Promise<T>;
}

export class LlmResponseTruncatedError extends Error {
  constructor(message = "The response was too long and got cut off. Try again, or shorten the CV/notes.") {
    super(message);
    this.name = "LlmResponseTruncatedError";
  }
}

/**
 * Thrown when the selected provider has no API key configured. Carries a
 * plain-language `userMessage` (safe to show as-is, no setup jargon) plus
 * the technical detail in `message` (for server logs only) — callers at
 * the API route boundary should always prefer `userMessage` when reporting
 * this to whoever is using the app, most of whom have never heard of an
 * environment variable.
 */
export class LlmNotConfiguredError extends Error {
  readonly userMessage =
    "This app isn't fully set up yet — it's missing the API key it needs to tailor CVs. Please let whoever set this up know.";

  constructor(technicalDetail: string) {
    super(technicalDetail);
    this.name = "LlmNotConfiguredError";
  }
}

/**
 * Wraps any error from the underlying provider's API call (auth failure,
 * rate limit, network error, malformed response) behind a stable,
 * plain-language message — the technical detail is preserved in `cause`
 * for server logs, never shown to the person using the app.
 */
export class LlmProviderError extends Error {
  readonly userMessage =
    "We couldn't reach the AI service that tailors your CV right now. Please try again in a moment.";

  constructor(technicalDetail: string, options?: { cause?: unknown }) {
    super(technicalDetail, options);
    this.name = "LlmProviderError";
  }
}
