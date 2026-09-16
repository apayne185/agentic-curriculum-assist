import { test, expect } from "@playwright/test";
import { z } from "zod";
import { toGeminiSchema } from "@/lib/llm/providers/json-schema-to-gemini";
import { cvDocumentSchema, cvStyleSchema } from "@/lib/cv-schema";

test.describe("toGeminiSchema", () => {
  test("converts primitive types to Gemini's uppercase type names", () => {
    const jsonSchema = z.toJSONSchema(z.object({ a: z.string(), b: z.number(), c: z.boolean() }));
    const result = toGeminiSchema(jsonSchema as Record<string, unknown>);
    expect(result).toEqual({
      type: "OBJECT",
      properties: {
        a: { type: "STRING" },
        b: { type: "NUMBER" },
        c: { type: "BOOLEAN" },
      },
      required: ["a", "b", "c"],
    });
  });

  test("converts enums to a STRING type with an enum list", () => {
    const jsonSchema = z.toJSONSchema(z.object({ kind: z.enum(["a", "b", "c"]) }));
    const result = toGeminiSchema(jsonSchema as Record<string, unknown>) as {
      properties: { kind: Record<string, unknown> };
    };
    expect(result.properties.kind).toEqual({ type: "STRING", enum: ["a", "b", "c"], format: "enum" });
  });

  test("converts arrays with their item type preserved", () => {
    const jsonSchema = z.toJSONSchema(z.object({ items: z.array(z.string()) }));
    const result = toGeminiSchema(jsonSchema as Record<string, unknown>) as {
      properties: { items: Record<string, unknown> };
    };
    expect(result.properties.items).toEqual({ type: "ARRAY", items: { type: "STRING" } });
  });

  test("omits 'required' when there are no required fields", () => {
    const jsonSchema = z.toJSONSchema(z.object({ maybe: z.string().optional() }));
    const result = toGeminiSchema(jsonSchema as Record<string, unknown>) as Record<string, unknown>;
    expect(result.required).toBeUndefined();
  });

  test("converts nested objects recursively", () => {
    const jsonSchema = z.toJSONSchema(
      z.object({ inner: z.object({ deep: z.string() }) }),
    );
    const result = toGeminiSchema(jsonSchema as Record<string, unknown>) as {
      properties: { inner: { type: string; properties: { deep: Record<string, unknown> } } };
    };
    expect(result.properties.inner.type).toBe("OBJECT");
    expect(result.properties.inner.properties.deep).toEqual({ type: "STRING" });
  });

  test("handles the real cvDocumentSchema without throwing and produces a valid OBJECT root", () => {
    const jsonSchema = z.toJSONSchema(cvDocumentSchema, { target: "draft-7" }) as Record<
      string,
      unknown
    >;
    delete jsonSchema.$schema;
    const result = toGeminiSchema(jsonSchema) as Record<string, unknown>;
    expect(result.type).toBe("OBJECT");
    expect(result.properties).toHaveProperty("header");
    expect(result.properties).toHaveProperty("sections");
    expect(result.properties).toHaveProperty("style");
  });

  test("handles the real cvStyleSchema's enums and numeric bounds without throwing", () => {
    const jsonSchema = z.toJSONSchema(cvStyleSchema, { target: "draft-7" }) as Record<
      string,
      unknown
    >;
    delete jsonSchema.$schema;
    const result = toGeminiSchema(jsonSchema) as {
      properties: { fontFamily: Record<string, unknown>; paperSize: Record<string, unknown> };
    };
    expect(result.properties.fontFamily.type).toBe("STRING");
    expect(result.properties.fontFamily.enum).toContain("Georgia");
    expect(result.properties.paperSize.enum).toEqual(["letter", "a4"]);
  });
});
