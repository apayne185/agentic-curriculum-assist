import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { LlmProvider, StructuredToolCall } from "../types";
import { LlmNotConfiguredError, LlmProviderError, LlmResponseTruncatedError } from "../types";

const MODEL = "claude-sonnet-5";

function jsonSchemaFor(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const full = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete full.$schema;
  return full as Anthropic.Tool.InputSchema;
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new LlmNotConfiguredError("ANTHROPIC_API_KEY is not set.");
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async runStructuredTool<T>(call: StructuredToolCall<T>): Promise<T> {
    const anthropic = this.getClient();

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: call.system,
        messages: [{ role: "user", content: call.userContent }],
        tools: [
          {
            name: call.toolName,
            description: call.toolDescription,
            input_schema: jsonSchemaFor(call.schema),
          },
        ],
        tool_choice: { type: "tool", name: call.toolName },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new LlmProviderError(`Anthropic API request failed: ${detail}`, { cause: err });
    }

    if (response.stop_reason === "max_tokens") {
      throw new LlmResponseTruncatedError();
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new LlmProviderError("Claude did not return a tool call as expected.");
    }
    return call.schema.parse(toolUse.input);
  }
}
