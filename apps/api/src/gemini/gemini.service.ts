import { GoogleGenAI } from '@google/genai'
import { Injectable, Logger } from '@nestjs/common'
import { BaseConfigService } from '../config/config.service'

export interface StructuredRequest {
  systemPrompt: string
  prompt: string
  /** JSON Schema in the OpenAPI subset the model accepts. */
  responseSchema: Record<string, unknown>
}

export interface StructuredResponse {
  /** Parsed JSON. Shape is the caller's business - this only guarantees JSON. */
  data: unknown
  model: string
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number
}

/** Raised when the model answers with something that is not JSON at all. */
export class MalformedModelResponseError extends Error {
  constructor(readonly raw: string) {
    super('The model did not return JSON')
    this.name = 'MalformedModelResponseError'
  }
}

/**
 * The Gemini SDK appears here and nowhere else.
 *
 * Knows nothing about resumes: it takes a prompt and a schema and returns
 * whatever JSON came back. What that JSON is supposed to mean belongs to the
 * caller, which is what keeps a second kind of extraction from having to
 * negotiate with this file.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name)
  private client?: GoogleGenAI

  constructor(private readonly config: BaseConfigService) {}

  async generateJson({
    systemPrompt,
    prompt,
    responseSchema,
  }: StructuredRequest): Promise<StructuredResponse> {
    const model = this.config.geminiModel
    const startedAt = Date.now()

    const response = await this.ai().models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema,
        // Extraction, not writing. The same document should give the same
        // answer twice.
        temperature: 0,
        abortSignal: AbortSignal.timeout(this.config.geminiTimeoutMs),
      },
    })

    const latencyMs = Date.now() - startedAt
    const text = response.text

    if (!text) throw new MalformedModelResponseError('')

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      // Schema-constrained output makes this unlikely, not impossible - a
      // response cut off by a token limit is still truncated JSON.
      this.logger.warn(`Model returned unparseable output after ${latencyMs}ms`)
      throw new MalformedModelResponseError(text)
    }

    return {
      data,
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      latencyMs,
    }
  }

  /**
   * Built on first use, so a process that never calls Gemini never demands the
   * key - the same reason the config exposes it as a getter.
   */
  private ai(): GoogleGenAI {
    this.client ??= new GoogleGenAI({ apiKey: this.config.geminiApiKey })

    return this.client
  }
}
