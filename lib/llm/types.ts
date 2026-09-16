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
