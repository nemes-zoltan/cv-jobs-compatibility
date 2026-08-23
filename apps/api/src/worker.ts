// Must be first, for the same reason as in main.ts - and it matters more here:
// a worker's traces are the long ones.
import './instrumentation'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { WorkerModule } from './worker/worker.module'

/**
 * The queue worker.
 *
 * An application context rather than a Nest application: there is no HTTP
 * server here, only providers and the pg-boss handlers they register.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule)
  // Lets pg-boss finish the job in flight when ECS sends SIGTERM.
  app.enableShutdownHooks()

  Logger.log('🛠️  Worker started')
}

bootstrap()
