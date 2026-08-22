import { Inject, Injectable, Logger } from '@nestjs/common'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import { type ResumeIngestionRow, resumeTexts } from '../../database/schema'
import { StorageService } from '../../storage/storage.service'
import { TextExtractionService } from './text-extraction.service'

/**
 * Step one: the stored file becomes text on the ingestion.
 *
 * Fetching, parsing and keeping the result are one step because they only ever
 * happen together and none of them means anything alone.
 */
@Injectable()
export class ResumeTextService {
  private readonly logger = new Logger(ResumeTextService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly extraction: TextExtractionService,
  ) {}

  async run(ingestion: ResumeIngestionRow): Promise<string> {
    const file = await this.storage.getObject(ingestion.storageKey)
    const { content, pageCount } = await this.extraction.extract(file, ingestion.contentType)

    // A retry re-extracts rather than reading back what the last attempt wrote:
    // the text is cheap to produce and the stored row may be from an older
    // parser.
    const values = { content, charCount: content.length, pageCount }

    await this.db
      .insert(resumeTexts)
      .values({ ingestionId: ingestion.id, ...values })
      .onConflictDoUpdate({ target: resumeTexts.ingestionId, set: values })

    this.logger.log(
      `Extracted ${content.length} characters from ${ingestion.filename}` +
        `${pageCount === null ? '' : ` (${pageCount} pages)`}`,
    )

    return content
  }
}
