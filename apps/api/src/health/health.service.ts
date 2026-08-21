import type { HealthResponse } from '@cv-jobs-compatibility/types'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DRIZZLE } from '../database/database.constants'
import type { Database } from '../database/database.module'

/** Read off the shared contract so the two cannot drift apart. */
type ServiceStatus = HealthResponse['services']['database']

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async check(): Promise<HealthResponse> {
    const database = await this.checkDatabase()
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      services: { database },
    }
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    try {
      // Cheapest possible round trip: proves the pool can hand out a live
      // connection, not just that the config parsed.
      await this.db.execute(sql`select 1`)
      return 'up'
    } catch (error) {
      this.logger.error('Database health check failed', error instanceof Error ? error.stack : String(error))
      return 'down'
    }
  }
}
