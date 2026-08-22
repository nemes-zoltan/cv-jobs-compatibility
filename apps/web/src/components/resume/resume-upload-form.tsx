'use client'

import { useRef, useState } from 'react'
import { FileTextIcon, UploadIcon } from 'lucide-react'
import { RESUME_FILE_EXTENSIONS } from '@cv-jobs-compatibility/constants'
import { Button } from '@cv-jobs-compatibility/components'
import { resumeFileError } from '@/lib/resume-api'

/**
 * Picks one file and hands it over. Everything after that - uploading, the
 * record, the progress - belongs to whoever rendered this.
 *
 * The file input is visually hidden rather than replaced, so the control stays
 * keyboard-accessible and the browser's own picker still drives it.
 */

export interface ResumeUploadFormProps {
  onSubmit: (file: File) => void
  disabled?: boolean
}

export function ResumeUploadForm({ onSubmit, disabled = false }: ResumeUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onSelect(selected: File | undefined): void {
    setError(null)

    if (!selected) {
      setFile(null)
      return
    }

    const problem = resumeFileError(selected)
    setFile(problem ? null : selected)
    setError(problem)
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault()
    if (!file || disabled) return

    onSubmit(file)
    setFile(null)
    // Without this, re-picking the same file fires no `change` event.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        name="resume"
        accept={RESUME_FILE_EXTENSIONS.join(',')}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => onSelect(event.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          Choose file
        </Button>

        <Button type="submit" disabled={!file || disabled}>
          Upload CV
        </Button>
      </div>

      {file && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileTextIcon className="size-4 shrink-0" />
          <span className="truncate">{file.name}</span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
