import { S3Client } from '@aws-sdk/client-s3'
import { Inject, Module, OnApplicationShutdown } from '@nestjs/common'
import { BaseConfigService } from '../config/config.service'
import { S3_CLIENT } from './storage.constants'
import { StorageService } from './storage.service'

/**
 * No boot-time connectivity check, unlike `DatabaseModule`: every route except
 * uploading works with the bucket unreachable, so failing to start would turn a
 * narrow outage into a total one.
 */
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [BaseConfigService],
      useFactory: (config: BaseConfigService) =>
        new S3Client({
          region: config.s3Region,
          // Both undefined in production: real endpoint, task role.
          endpoint: config.s3Endpoint,
          credentials: config.s3Credentials,
          forcePathStyle: config.s3ForcePathStyle,
        }),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule implements OnApplicationShutdown {
  constructor(@Inject(S3_CLIENT) private readonly client: S3Client) {}

  onApplicationShutdown(): void {
    this.client.destroy()
  }
}
