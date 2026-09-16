import { z } from "zod";
import type { LlmProvider, StructuredToolCall } from "../types";
import { LlmResponseTruncatedError } from "../types";
import { toGeminiSchema } from "./json-schema-to-gemini";

// Gemini 2.5 Flash has a free tier (rate-limited, no billing required) via
// Google AI Studio — the most realistic free alternative to a paid API for
// this app. https://ai.google.dev/gemini-api/docs/rate-limits
const MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
};

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";

  private getApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local before using the tailoring features (LLM_PROVIDER=gemini).",
      );
    }
    return apiKey;
  }

  async runStructuredTool<T>(call: StructuredToolCall<T>): Promise<T> {
    const apiKey = this.getApiKey();
    const jsonSchema = z.toJSONSchema(call.schema, { target: "draft-7" }) as Record<string, unknown>;
    delete jsonSchema.$schema;

    const response = await fetch(
      `${API_BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: call.system }] },
          contents: [{ role: "user", parts: [{ text: call.userContent }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: toGeminiSchema(jsonSchema),
            maxOutputTokens: 16000,
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemini API error (${response.status}): ${body.slice(0, 500)}`);
    }

    const data: GeminiResponse = await response.json();
    const candidate = data.candidates?.[0];

    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new LlmResponseTruncatedError();
    }

    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) {
      throw new Error("Gemini did not return a response as expected.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON.");
    }
    return call.schema.parse(parsed);
  }
}
