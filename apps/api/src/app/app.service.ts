import type { AppInfoResponse } from '@cv-jobs-compatibility/types'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getData(): AppInfoResponse {
    return { message: 'Hello API' }
  }
}
