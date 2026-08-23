'use client'

import { useState } from 'react'
import { LinkIcon } from 'lucide-react'
import {
  MAX_JOB_TEXT_CHARS,
  MIN_JOB_TEXT_CHARS,
} from '@cv-jobs-compatibility/constants'
import type { CreateJobRequest } from '@cv-jobs-compatibility/types'
import { Button, Input, Textarea } from '@cv-jobs-compatibility/components'

/**
 * Takes a pasted advert and hands it over. What happens to it afterwards
 * belongs to whoever rendered this.
 *
 * The link is optional and never fetched - job boards block that, and a URL
 * that works today is a dead page in a fortnight. It is here so the posting has
 * somewhere to point back to.
 */

export interface JobPasteFormProps {
  onSubmit: (request: CreateJobRequest) => void
  disabled?: boolean
}

export function JobPasteForm({ onSubmit, disabled = false }: JobPasteFormProps) {
  const [text, setText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  const trimmed = text.trim()
  const short = trimmed.length > 0 && trimmed.length < MIN_JOB_TEXT_CHARS
  const ready = trimmed.length >= MIN_JOB_TEXT_CHARS && !disabled

  function submit(event: React.FormEvent): void {
    event.preventDefault()
    if (!ready) return

    onSubmit({ text: trimmed, sourceUrl: sourceUrl.trim() || undefined })
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4">
      <Textarea
        name="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        rows={12}
        maxLength={MAX_JOB_TEXT_CHARS}
        aria-label="Job posting"
        placeholder="Paste the whole advert here - the responsibilities and what they're asking for, not just the title."
        className="resize-y font-normal"
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <LinkIcon className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Link to the posting</span>
        <Input
          type="url"
          name="sourceUrl"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          disabled={disabled}
          placeholder="Link to the posting (optional)"
          className="h-9"
        />
      </label>

      {/* Last, under every field it acts on. A submit button sitting above an
          input reads as belonging to what came before it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {short
            ? `${MIN_JOB_TEXT_CHARS - trimmed.length} more characters needed`
            : `${trimmed.length.toLocaleString()} characters`}
        </p>

        <Button type="submit" disabled={!ready}>
          Add posting
        </Button>
      </div>
    </form>
  )
}
