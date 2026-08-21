/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app/app.module'
import { BaseConfigService } from './config/config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(BaseConfigService)
  const globalPrefix = 'api'
  app.setGlobalPrefix(globalPrefix)
  app.enableCors({ origin: config.webOrigin })
  // Lets DatabaseModule close the connection pool on SIGTERM, which is what ECS
  // sends before it kills the task.
  app.enableShutdownHooks()
  await app.listen(config.port)
  Logger.log(`🚀 Application is running on: http://localhost:${config.port}/${globalPrefix} [${config.nodeEnv}]`)
}

bootstrap()
