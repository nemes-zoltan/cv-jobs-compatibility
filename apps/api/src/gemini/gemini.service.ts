import { GoogleGenAI } from '@google/genai'
import { Injectable, Logger } from '@nestjs/common'
import type { Span } from '@opentelemetry/api'
import { BaseConfigService } from '../config/config.service'
import { TelemetryService } from '../telemetry/telemetry.service'

export interface StructuredRequest {
  systemPrompt: string
  prompt: string
  /** JSON Schema in the OpenAPI subset the model accepts. */
  responseSchema: Record<string, unknown>
  /**
   * Lets the model search the web before answering.
   *
   * Only worth turning on where the answer depends on facts outside the
   * prompt - it costs a round trip through search and a good deal of latency,
   * and it changes what the model is allowed to invent, which is the point.
   *
   * Gemini 3 permits this alongside a response schema; earlier models did not,
   * so a downgrade of `GEMINI_MODEL` breaks it rather than degrading quietly.
   */
  searchTheWeb?: boolean
  /**
   * Extraction wants the same answer twice from the same document. Anything
   * that reasons or searches wants a little room, and gets it explicitly.
   */
  temperature?: number
}

export interface StructuredResponse {
  /** Parsed JSON. Shape is the caller's business - this only guarantees JSON. */
  data: unknown
  model: string
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number
  /** The queries the model actually ran. Empty unless it searched. */
  searchQueries: string[]
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

  constructor(
    private readonly config: BaseConfigService,
    private readonly telemetry: TelemetryService,
  ) {}

  generateJson(request: StructuredRequest): Promise<StructuredResponse> {
    /**
     * Every model call is a span, because these are the slowest and most
     * expensive things the system does and the only ones with a per-request
     * price. Tokens land as attributes so cost and latency can be read per
     * model and per call type without parsing a log line.
     */
    return this.telemetry.withSpan(
      `gemini ${this.config.geminiModel}`,
      (span) => this.call(request, span),
      {
        'gen_ai.system': 'gcp.gemini',
        'gen_ai.request.model': this.config.geminiModel,
        'gen_ai.request.temperature': request.temperature ?? 0,
        // Not a standard attribute, but the distinction that matters most here:
        // a grounded call is a different price and a different failure mode.
        'gen_ai.request.search_grounded': request.searchTheWeb ?? false,
      },
    )
  }

  private async call(
    { systemPrompt, prompt, responseSchema, searchTheWeb = false, temperature = 0 }: StructuredRequest,
    span: Span,
  ): Promise<StructuredResponse> {
    const model = this.config.geminiModel
    const startedAt = Date.now()

    const response = await this.ai().models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema,
        tools: searchTheWeb ? [{ googleSearch: {} }] : undefined,
        temperature,
        abortSignal: AbortSignal.timeout(this.config.geminiTimeoutMs),
      },
    })

    const latencyMs = Date.now() - startedAt
    const text = response.text

    // What it actually looked up. The citation chunks come back empty when a
    // schema is in play, which is why callers that need sources ask for them
    // inside the schema instead - but the queries still arrive, and they are
    // the difference between "it searched" and "it says it searched".
    const searchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? []
    if (searchTheWeb) {
      this.logger.log(
        searchQueries.length > 0
          ? `Searched: ${searchQueries.join(' | ')}`
          : 'Search was enabled but the model ran no queries',
      )
    }

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

    span.setAttributes({
      'gen_ai.usage.input_tokens': response.usageMetadata?.promptTokenCount ?? 0,
      'gen_ai.usage.output_tokens': response.usageMetadata?.candidatesTokenCount ?? 0,
      'gen_ai.search_queries': searchQueries.length,
    })

    return {
      data,
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      latencyMs,
      searchQueries,
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
