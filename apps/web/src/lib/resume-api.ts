import { MAX_RESUME_BYTES, isResumeContentType } from '@cv-jobs-compatibility/constants'
import type {
  CreateResumeIngestionRequest,
  MyResumeResponse,
  CreateUploadUrlRequest,
  CreateUploadUrlResponse,
  ResumeIngestionModel,
} from '@cv-jobs-compatibility/types'
import { ApiError, apiFetch } from './api'

/**
 * Sign, upload, report. The middle step goes straight to object storage, which
 * is why it is a plain `fetch` and not `apiFetch`.
 */

function createUploadUrl(request: CreateUploadUrlRequest): Promise<CreateUploadUrlResponse> {
  return apiFetch('/resumes/ingestions/upload-url', { method: 'POST', body: request })
}

function createUpload(request: CreateResumeIngestionRequest): Promise<ResumeIngestionModel> {
  return apiFetch('/resumes/ingestions', { method: 'POST', body: request })
}

/** Where an upload has got to. Safe to call repeatedly - it is a plain read. */
export function fetchResumeUpload(id: string): Promise<ResumeIngestionModel> {
  return apiFetch(`/resumes/ingestions/${id}`)
}

/** The caller's parsed CV. Rejects with a 404 until one exists. */
export function fetchMyResume(): Promise<MyResumeResponse> {
  return apiFetch('/resumes/me')
}

/** Throws an upload away: rejected, stalled, or being replaced. */
export function deleteResumeUpload(id: string): Promise<void> {
  return apiFetch(`/resumes/ingestions/${id}`, { method: 'DELETE' })
}

/**
 * The upload still being processed, if there is one. Lets a page reloaded
 * mid-pipeline pick the progress back up instead of offering a second upload.
 */
export function fetchPendingResumeUpload(): Promise<ResumeIngestionModel | null> {
  return apiFetch('/resumes/ingestions/pending')
}

/**
 * `credentials` stays at its default so session cookies are not sent to the
 * storage host - the presigned URL is the whole authorisation. `Content-Type`
 * must match what was signed.
 */
async function putToStorage(uploadUrl: string, file: File): Promise<void> {
  let response: Response

  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
  } catch {
    // A CORS rejection lands here too - the browser will not say which.
    throw new ApiError(0, 'Could not reach file storage. Check your connection and try again.')
  }

  if (!response.ok) {
    throw new ApiError(response.status, 'The upload was rejected by file storage. Please try again.')
  }
}

export type UploadStage = 'preparing' | 'uploading' | 'finishing'

/** Not a security boundary - it just saves a round trip. The API re-checks. */
export function resumeFileError(file: File): string | null {
  if (!isResumeContentType(file.type)) return 'Only PDF and DOCX files are accepted.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_RESUME_BYTES) return 'That file is larger than 10 MB.'

  return null
}

export async function uploadResume(
  file: File,
  onStage?: (stage: UploadStage) => void,
): Promise<ResumeIngestionModel> {
  const request = { filename: file.name, contentType: file.type, sizeBytes: file.size }

  onStage?.('preparing')
  const { key, uploadUrl } = await createUploadUrl(request)

  onStage?.('uploading')
  await putToStorage(uploadUrl, file)

  // Only now is anything recorded. Failing earlier leaves an unreferenced
  // object and nothing in the application.
  onStage?.('finishing')

  return createUpload({ key, ...request })
}
