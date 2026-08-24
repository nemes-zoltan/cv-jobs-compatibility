import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

/**
 * OpenTelemetry bootstrap.
 *
 * MUST be imported as the very first line of `main.ts` and `worker.ts`, before
 * any other import. The SDK patches `http`, `express` and `pg` at require()
 * time, so it has to start before Nest pulls those modules in.
 *
 * Both entrypoints load this and each names itself, so a span can always be
 * attributed to the process that made it - the API and the worker share every
 * source file and would otherwise be indistinguishable in a trace.
 *
 * Configuration is the standard environment, and nothing is hard-coded here:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  e.g. http://localhost:4318
 *   OTEL_SERVICE_NAME            e.g. cv-jobs-api
 *   OTEL_ID_GENERATOR            `xray`, or unset for W3C ids
 *
 * The exporter speaks OTLP and nothing else, which is what makes the
 * destination a deployment concern rather than a code one: the same bundle
 * talks to a Grafana container locally and to an ADOT sidecar translating for
 * X-Ray in a deployment, and neither is named in here.
 */

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

/**
 * X-Ray does not accept a random trace id.
 *
 * It reads the first four bytes as a unix timestamp and rejects a segment whose
 * timestamp is in the future or more than a month old - which a W3C id, being
 * 16 random bytes, essentially always is. The generator differs only in
 * spending those four bytes on the current time, so ids stay unique and remain
 * valid W3C ids that any other backend reads normally.
 *
 * Opt-in rather than automatic: this is the one AWS-shaped thing in the file,
 * and a developer exporting to the local Grafana container should get ordinary
 * random ids.
 */
const idGenerator = process.env.OTEL_ID_GENERATOR === 'xray' ? new AWSXRayIdGenerator() : undefined

/**
 * No endpoint, no telemetry.
 *
 * Starting the SDK anyway would default the exporter to localhost:4318 and fill
 * a developer's terminal with connection errors every few seconds for a
 * collector they did not ask to run. Tracing is opt-in by setting the variable.
 */
if (endpoint) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'cv-jobs-api',
    }),
    // No endpoint passed: the OTLP/HTTP exporter reads the environment itself
    // and appends `/v1/traces`.
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
    // `undefined` leaves the SDK on its own random-id default.
    idGenerator,
  })

  sdk.start()

  // Spans are batched, so a container stopping mid-batch loses them. This is
  // also why the worker matters more than the API here: its traces are minutes
  // long and a redeploy lands in the middle of one.
  const shutdown = () => {
    sdk
      .shutdown()
      .catch((error) => console.error('OTel shutdown error', error))
      .finally(() => process.exit(0))
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
