import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { BaseConfigService } from '../config/config.service'
import { UsersModule } from '../users/users.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'

@Module({
  imports: [
    UsersModule,
    // No global `signOptions`: each token sets its own lifetime at signing
    // time, so the two TTLs stay next to the code that decides them.
    JwtModule.registerAsync({
      inject: [BaseConfigService],
      useFactory: (config: BaseConfigService) => ({ secret: config.jwtSecret }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // A module that guards its own routes with `@UseGuards(JwtAuthGuard)` needs
  // both: Nest builds the guard in the importing module's context, and the
  // guard depends on AuthService.
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
