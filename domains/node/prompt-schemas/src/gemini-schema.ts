import { z } from 'zod'

/** A JSON Schema in the OpenAPI 3.0 subset Gemini accepts as `responseSchema`. */
export type GeminiSchema = Record<string, unknown>

/**
 * Gemini validates `responseSchema` against its own Schema type and rejects
 * fields it does not know. `additionalProperties` is one of them, and zod emits
 * it on every object, so it is stripped here rather than at each call site.
 */
function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported)
  if (node === null || typeof node !== 'object') return node

  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([key]) => key !== 'additionalProperties')
      .map(([key, value]) => [key, stripUnsupported(value)]),
  )
}

/**
 * Turns a zod schema into the one we send to Gemini.
 *
 * `openapi-3.0` is what produces `nullable: true` instead of a union of types,
 * and `inline` keeps `$ref` out of the result - Gemini supports neither.
 */
export function toGeminiSchema(schema: z.ZodType): GeminiSchema {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    // The schema describes what the model returns, not what it accepts.
    io: 'output',
    reused: 'inline',
  })

  return stripUnsupported(json) as GeminiSchema
}
