import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { HealthModule } from '../health/health.module'
import { UsersModule } from '../users/users.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, UsersModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
