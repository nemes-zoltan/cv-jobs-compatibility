import { Global, Inject, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { BaseConfigService } from '../config/config.service'
import { redactDatabaseUrl } from '../config/database-url'
import { DRIZZLE, PG_POOL } from './database.constants'
import * as schema from './schema'

/** Inject with `@Inject(DRIZZLE) private readonly db: Database`. */
export type Database = NodePgDatabase<typeof schema>

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [BaseConfigService],
      useFactory: (config: BaseConfigService) =>
        new Pool({
          connectionString: config.databaseUrl,
          max: config.databasePoolMax,
          // `pg` keeps this option even when a connection string is given, so
          // the environment's TLS policy always wins.
          ssl: config.databaseSsl,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL, BaseConfigService],
      // `casing` lets the schema stay camelCase in TypeScript while the columns
      // it generates stay snake_case in Postgres. Must match drizzle.config.ts.
      useFactory: (pool: Pool, config: BaseConfigService) =>
        drizzle(pool, { schema, casing: 'snake_case', logger: config.databaseLogging }),
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name)

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly config: BaseConfigService,
  ) {}

  /**
   * `new Pool()` is lazy, so without this the first request would be the one to
   * discover a misconfigured or unreachable database. Fail at boot instead.
   */
  async onModuleInit(): Promise<void> {
    const target = redactDatabaseUrl(this.config.databaseUrl)
    try {
      const client = await this.pool.connect()
      client.release()
      this.logger.log(`Connected to ${target}`)
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      // The local hint is noise in a deployed log stream.
      const hint = this.config.isProduction
        ? ''
        : ' Start it with `pnpm --filter @cv-jobs-compatibility/api run db:up`.'
      throw new Error(`Cannot reach the database at ${target}.${hint} Cause: ${cause}`)
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
    this.logger.log('Database pool closed')
  }
}
