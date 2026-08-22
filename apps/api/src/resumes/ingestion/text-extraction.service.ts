import { type ResumeContentType, isResumeContentType } from '@cv-jobs-compatibility/constants'
import { Injectable } from '@nestjs/common'
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import { TerminalIngestionError } from './ingestion-errors'

export interface ExtractedText {
  content: string
  /** PDF only. DOCX has no pages until it is laid out, so null. */
  pageCount: number | null
}

/**
 * A scanned CV is an image of text, and neither library does OCR - so a photo
 * of a perfectly good resume extracts to nothing. Below this many characters we
 * treat the file as unreadable rather than sending near-empty text to a model
 * that would dutifully invent a CV from it.
 */
const MIN_USEFUL_CHARACTERS = 200

/** The only place a document format is parsed. Everything else deals in text. */
@Injectable()
export class TextExtractionService {
  async extract(file: Buffer, contentType: string): Promise<ExtractedText> {
    if (!isResumeContentType(contentType)) {
      throw new TerminalIngestionError(`Unsupported content type "${contentType}"`)
    }

    const extracted = await this.read(file, contentType)
    const content = normalise(extracted.content)

    if (content.length < MIN_USEFUL_CHARACTERS) {
      throw new TerminalIngestionError(
        `Only ${content.length} characters of text - the file is probably a scan or an image`,
      )
    }

    return { ...extracted, content }
  }

  private async read(file: Buffer, contentType: ResumeContentType): Promise<ExtractedText> {
    if (contentType === 'application/pdf') {
      // `getDocumentProxy` first so the page count comes from the same parse.
      const pdf = await getDocumentProxy(new Uint8Array(file))
      const { totalPages, text } = await extractText(pdf, { mergePages: true })

      return { content: text, pageCount: totalPages }
    }

    const { value } = await mammoth.extractRawText({ buffer: file })

    return { content: value, pageCount: null }
  }
}

/**
 * PDF text arrives with the layout's line breaks baked in, so a two-column CV
 * comes out ragged. Only the obviously meaningless is cleaned up - collapsing
 * further would join headings to the paragraphs under them.
 */
function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // Soft hyphen and zero-width characters, which PDFs are full of.
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
