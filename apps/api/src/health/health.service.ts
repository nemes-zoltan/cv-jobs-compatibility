import { Inject, Injectable, Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DRIZZLE } from '../database/database.constants'
import { Database } from '../database/database.module'

export type ServiceStatus = 'up' | 'down'

export interface HealthReport {
  status: 'ok' | 'degraded'
  services: { database: ServiceStatus }
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async check(): Promise<HealthReport> {
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
