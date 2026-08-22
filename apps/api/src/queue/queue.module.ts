import { DynamicModule, Inject, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { PgBoss } from 'pg-boss'
import { BaseConfigService } from '../config/config.service'
import { PG_BOSS, PG_BOSS_SCHEMA, QUEUES } from './queue.constants'

export interface QueueModuleOptions {
  /**
   * Whether this process runs pg-boss's maintenance: expiring stale jobs,
   * archiving completed ones, running cron schedules.
   *
   * Only the worker should. Enabling it in every API instance means several
   * processes competing to maintain the same tables for no benefit.
   */
  supervise: boolean
}

/**
 * pg-boss, wired to the same database as everything else.
 *
 * It gets its own pool rather than sharing Drizzle's, because it holds a
 * dedicated connection for LISTEN/NOTIFY and would otherwise starve request
 * handling. Enqueueing inside an application transaction is still possible -
 * pass `fromDrizzle(tx, sql)` as the `db` option on `send`.
 */
@Module({})
export class QueueModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueModule.name)

  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  static forRoot({ supervise }: QueueModuleOptions): DynamicModule {
    return {
      module: QueueModule,
      global: true,
      providers: [
        {
          provide: PG_BOSS,
          inject: [BaseConfigService],
          useFactory: (config: BaseConfigService) =>
            new PgBoss({
              connectionString: config.databaseUrl,
              ssl: config.databaseSsl,
              max: config.queuePoolMax,
              schema: PG_BOSS_SCHEMA,
              // The schema is installed by a migration, like every other table.
              // Letting pg-boss build it on boot would have each instance race
              // to alter the schema on every deploy - see DECISIONS.md.
              migrate: false,
              createSchema: false,
              supervise,
              schedule: supervise,
            }),
        },
      ],
      exports: [PG_BOSS],
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.boss.start()
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Could not start pg-boss. If the "${PG_BOSS_SCHEMA}" schema is missing, apply migrations first with \`pnpm db:migrate\`. Cause: ${cause}`,
      )
    }

    // Queues are rows, not just names, and `send` fails against one that does
    // not exist. Creating them here keeps a new environment working without a
    // manual step.
    for (const name of Object.values(QUEUES)) {
      if (!(await this.boss.getQueue(name))) {
        await this.boss.createQueue(name)
        this.logger.log(`Created queue "${name}"`)
      }
    }

    this.boss.on('error', (error) => this.logger.error('pg-boss error', error))
  }

  async onApplicationShutdown(): Promise<void> {
    // Lets a job in flight finish rather than killing it mid-transaction.
    await this.boss.stop({ graceful: true })
    this.logger.log('pg-boss stopped')
  }
}
