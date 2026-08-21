/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app/app.module'
import { BaseConfigService } from './config/config.service'

// `cookie-parser` is a CommonJS module using `export =`, and this workspace does
// not enable `esModuleInterop`. Import-equals is the form that stays callable.
import cookieParser = require('cookie-parser')

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(BaseConfigService)
  const globalPrefix = 'api'
  app.setGlobalPrefix(globalPrefix)
  // Auth tokens travel as cookies, so the guard needs them parsed off the
  // request. Unsigned: the tokens are already signed JWTs.
  app.use(cookieParser())
  // `credentials` is what lets the browser attach the auth cookies to a
  // cross-origin call, which is how the web app reaches the API in development.
  // A deployment puts both behind one origin and this stops mattering.
  app.enableCors({ origin: config.webOrigin, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties, then reject the request that sent them: a
      // client posting fields the DTO does not declare is a client that has
      // misunderstood the endpoint, and silence there hides bugs.
      whitelist: true,
      forbidNonWhitelisted: true,
      // DTOs are plain classes until class-transformer instantiates them.
      transform: true,
    }),
  )
  // Lets DatabaseModule close the connection pool on SIGTERM, which is what ECS
  // sends before it kills the task.
  app.enableShutdownHooks()
  await app.listen(config.port)
  Logger.log(`🚀 Application is running on: http://localhost:${config.port}/${globalPrefix} [${config.nodeEnv}]`)
}

bootstrap()
