# Logs and traces.
#
# The applications already emit OTLP and already carry W3C traceparent across
# the pg-boss job boundary (TelemetryService injects it into the payload, the
# worker extracts it), so a resume upload is one trace spanning two processes
# that never talk to each other directly. None of that is configured here.
#
# What is configured here is only the destination: an ADOT collector as a
# sidecar, receiving OTLP on localhost and translating to X-Ray. The application
# sends to 127.0.0.1:4318 and never learns where its spans end up - swapping
# X-Ray for anything else is a change to this file, not to the code.

resource "aws_cloudwatch_log_group" "services" {
  for_each = toset(["api", "web", "worker", "migrate", "adot"])

  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = var.log_retention_days
}

locals {
  # Narrower than the image's bundled config, which also stands up an `awsemf`
  # metrics pipeline. Nothing reads those metrics and they bill as custom
  # CloudWatch metrics, so this is traces and nothing else.
  adot_config = yamlencode({
    receivers = {
      # HTTP only. The Node SDK uses OTLP/HTTP, so a gRPC receiver would be an
      # open port nothing connects to.
      otlp = { protocols = { http = { endpoint = "0.0.0.0:4318" } } }
    }
    # The worker's traces run for minutes; batching stops a span sitting in
    # memory until the process happens to exit.
    processors = { batch = { timeout = "5s" } }
    exporters  = { awsxray = { region = var.aws_region } }
    service = {
      pipelines = {
        traces = { receivers = ["otlp"], processors = ["batch"], exporters = ["awsxray"] }
      }
    }
  })

  # Added to the API and worker tasks. Not to the web task: the Next.js app
  # carries no OpenTelemetry instrumentation, so a collector beside it would
  # receive nothing. The trace starts at the API, not in the browser.
  adot_sidecar = {
    name  = "adot"
    image = var.adot_image

    # A collector that dies must not take the API with it. Losing traces is a
    # bad day; losing the service is an outage.
    essential = false

    # The image's entrypoint is the collector binary, so this replaces its
    # default --config. `env:` is the collector's own config provider, which is
    # what lets the config live here instead of in a derived image.
    command     = ["--config=env:AOT_CONFIG_CONTENT"]
    environment = [{ name = "AOT_CONFIG_CONTENT", value = local.adot_config }]

    # Soft limit. Starving the application it is meant to be observing would be
    # a poor trade.
    memoryReservation = 128

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services["adot"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "adot"
      }
    }
  }

  # OTEL_ID_GENERATOR is the one AWS-shaped thing the application has to be
  # told: X-Ray reads the first four bytes of a trace id as a unix timestamp and
  # rejects a random one, so a plain W3C id is discarded on arrival. Unset
  # everywhere else, including locally.
  telemetry_environment = [
    { name = "OTEL_EXPORTER_OTLP_ENDPOINT", value = "http://localhost:4318" },
    { name = "OTEL_ID_GENERATOR", value = "xray" },
  ]
}
