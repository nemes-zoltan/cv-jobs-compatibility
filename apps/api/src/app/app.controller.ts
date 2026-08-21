import type { AppInfoResponse } from '@cv-jobs-compatibility/types'
import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData(): AppInfoResponse {
    return this.appService.getData()
  }
}
