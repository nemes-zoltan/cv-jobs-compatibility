import { Module } from '@nestjs/common'
import { GeminiService } from './gemini.service'

/** Imported by the worker only - the HTTP process never calls a model. */
@Module({
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
