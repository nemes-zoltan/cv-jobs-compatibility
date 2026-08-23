import { Global, Module } from '@nestjs/common'
import { TelemetryService } from './telemetry.service'

/**
 * Global, so a span can be started anywhere without every module re-importing
 * this one. Imported once by each entrypoint's root module.
 *
 * Note what is not here: no provider for the SDK. Starting it is
 * `instrumentation.ts`'s job and has to happen before Nest exists at all, so
 * this module only exposes a way to talk to whatever is already running.
 */
@Global()
@Module({
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
