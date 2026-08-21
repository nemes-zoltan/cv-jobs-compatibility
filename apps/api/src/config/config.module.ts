import { Global, Module } from '@nestjs/common'
import { BaseConfigService } from './config.service'
import { DevelopmentConfigService } from './development-config.service'
import { ProductionConfigService } from './production-config.service'

/**
 * Provides one config instance under the `BaseConfigService` token, so callers
 * inject the base class and stay unaware of which environment they run in.
 */
@Global()
@Module({
  providers: [
    {
      provide: BaseConfigService,
      // Resolved at startup from the running environment, not at build time, so
      // the same image behaves correctly wherever it is deployed.
      useFactory: (): BaseConfigService =>
        process.env.NODE_ENV === 'production'
          ? new ProductionConfigService()
          : new DevelopmentConfigService(),
    },
  ],
  exports: [BaseConfigService],
})
export class ConfigModule {}
