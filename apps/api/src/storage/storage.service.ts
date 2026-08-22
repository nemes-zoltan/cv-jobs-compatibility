import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Inject, Injectable } from '@nestjs/common'
import { BaseConfigService } from '../config/config.service'
import { S3_CLIENT } from './storage.constants'

export interface UploadUrlInput {
  key: string
  /** Signed into the URL: a `PUT` sending anything else is refused. */
  contentType: string
}

export interface UploadUrl {
  url: string
  expiresAt: Date
}

/** What storage says about an object, as opposed to what a client claimed. */
export interface StoredObject {
  sizeBytes: number
  contentType: string
}

/** The S3 SDK appears here and nowhere else; everything else deals in keys. */
@Injectable()
export class StorageService {
  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    private readonly config: BaseConfigService,
  ) {}

  /**
   * A short-lived URL the browser can `PUT` one object to.
   *
   * Size is deliberately not signed: binding an exact `Content-Length` turns any
   * mismatch into an opaque 403. It is checked when the URL is minted and again
   * with `HeadObject` before the file is processed.
   */
  async createUploadUrl({ key, contentType }: UploadUrlInput): Promise<UploadUrl> {
    const expiresIn = this.config.uploadUrlTtl

    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn },
    )

    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) }
  }

  /**
   * What is actually at a key, or null if nothing is.
   *
   * The size and type here are the ones to trust. A client reports its own
   * after uploading, but only storage knows what the `PUT` really carried.
   */
  async headObject(key: string): Promise<StoredObject | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.s3Bucket, Key: key }),
      )

      return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? '' }
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
  }

  /**
   * The whole object in memory. Safe because uploads are capped well below any
   * amount worth streaming; a larger limit would want the stream instead.
   */
  async getObject(key: string): Promise<Buffer> {
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.s3Bucket, Key: key }),
    )

    if (!object.Body) throw new Error(`Object "${key}" has no body`)

    return Buffer.from(await object.Body.transformToByteArray())
  }

  /** Deleting a key that is not there succeeds, which is what makes a repeated
   * delete harmless. */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.s3Bucket, Key: key }))
  }
}

/** S3 answers a missing key with `NotFound`, MinIO sometimes with `NoSuchKey`. */
function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const { name, $metadata } = error as { name?: string; $metadata?: { httpStatusCode?: number } }

  return name === 'NotFound' || name === 'NoSuchKey' || $metadata?.httpStatusCode === 404
}
