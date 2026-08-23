import { Injectable } from '@nestjs/common'
import {
  type Attributes,
  type Context,
  ROOT_CONTEXT,
  type Span,
  SpanStatusCode,
  type Tracer,
  context,
  propagation,
  trace,
} from '@opentelemetry/api'

/**
 * A carrier for the trace, riding along inside a queue job.
 *
 * The W3C fields verbatim rather than an id of our own, so anything that
 * understands `traceparent` - a collector, X-Ray, another service - can follow
 * the thread without knowing anything about this application.
 */
export interface JobTraceCarrier {
  traceparent?: string
  tracestate?: string
}

/**
 * Thin, injectable facade over the global OpenTelemetry API.
 *
 * Holds no state: it talks to the globally-registered provider that
 * `instrumentation.ts` starts. When no endpoint is configured the SDK never
 * starts and every method here quietly no-ops, which is what lets the workers
 * be instrumented unconditionally without a developer having to run a
 * collector.
 */
@Injectable()
export class TelemetryService {
  private readonly tracer: Tracer = trace.getTracer(
    process.env.OTEL_SERVICE_NAME ?? 'cv-jobs-api',
  )

  /** Add a timestamped event to whatever span is currently active. */
  addEvent(name: string, attributes?: Attributes): void {
    trace.getActiveSpan()?.addEvent(name, attributes)
  }

  /** Tag the current span with key/values. */
  setAttributes(attributes: Attributes): void {
    trace.getActiveSpan()?.setAttributes(attributes)
  }

  /** Run `fn` inside a new child span, handling `end()` and error recording. */
  withSpan<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Attributes): Promise<T> {
    return this.tracer.startActiveSpan(name, { attributes }, (span) => this.run(span, fn))
  }

  /**
   * The same, but continuing a trace that started in another process.
   *
   * This is what turns three separate pipelines into one story. A posting is
   * pasted in the API, extracted by the worker seconds later, briefed after
   * that, and scored when somebody presses a button - four processes' worth of
   * spans that are otherwise four unrelated traces.
   */
  withLinkedSpan<T>(
    name: string,
    carrier: JobTraceCarrier,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes,
  ): Promise<T> {
    // From ROOT rather than the active context: a queue handler has no
    // meaningful parent of its own, and inheriting one would attach every job
    // to whichever job happened to run before it.
    const parent = propagation.extract(ROOT_CONTEXT, carrier)

    return context.with(parent, () =>
      this.tracer.startActiveSpan(name, { attributes }, (span) => this.run(span, fn)),
    )
  }

  /**
   * The current trace, as fields to put in a job payload.
   *
   * Empty when nothing is being traced, which keeps the payload honest: a job
   * enqueued outside a trace carries no carrier rather than a broken one.
   */
  carrier(from: Context = context.active()): JobTraceCarrier {
    const carrier: JobTraceCarrier = {}
    propagation.inject(from, carrier)

    return carrier
  }

  private async run<T>(span: Span, fn: (span: Span) => Promise<T>): Promise<T> {
    try {
      return await fn(span)
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  }
}
