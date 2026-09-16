// Converts a subset of JSON Schema (draft-7, as produced by zod's
// toJSONSchema()) into Gemini's structured-output schema dialect — a
// restricted subset of OpenAPI 3.0 that, unlike draft-7, requires every
// node to declare a "type" and does not understand keywords like
// "$schema", "additionalProperties", or a bare "default". This targets
// exactly the shapes cv-schema.ts produces (objects, arrays, strings,
// numbers, booleans, enums, optional fields) rather than being a general
// JSON-Schema-to-OpenAPI converter.
type JsonSchemaNode = Record<string, unknown>;

export function toGeminiSchema(node: JsonSchemaNode): JsonSchemaNode {
  if (node.enum) {
    return { type: "STRING", enum: node.enum, format: "enum" };
  }

  const type = node.type as string | undefined;

  if (type === "object") {
    const properties = (node.properties ?? {}) as Record<string, JsonSchemaNode>;
    const converted: Record<string, JsonSchemaNode> = {};
    for (const [key, value] of Object.entries(properties)) {
      converted[key] = toGeminiSchema(value);
    }
    const result: JsonSchemaNode = { type: "OBJECT", properties: converted };
    if (Array.isArray(node.required) && node.required.length > 0) {
      result.required = node.required;
    }
    return result;
  }

  if (type === "array") {
    const items = (node.items ?? { type: "string" }) as JsonSchemaNode;
    return { type: "ARRAY", items: toGeminiSchema(items) };
  }

  if (type === "string") return { type: "STRING" };
  if (type === "number" || type === "integer") return { type: "NUMBER" };
  if (type === "boolean") return { type: "BOOLEAN" };

  // Fallback for anything unrecognized (shouldn't hit this for our schemas).
  return { type: "STRING" };
}
