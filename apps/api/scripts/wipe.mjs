/**
 * Clears everything an upload leaves behind: the ingestion and whatever hangs
 * off it, its queued jobs, and the stored files themselves.
 *
 * Both halves are needed - deleting rows alone leaves objects in the bucket
 * that nothing references, which is exactly the mess this is meant to avoid
 * while iterating on the pipeline.
 *
 * Accounts are left alone, so you stay signed in.
 *
 * Run with `pnpm --filter @cv-jobs-compatibility/api run db:wipe`.
 */

import 'dotenv/config'
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { Pool } from 'pg'

const RESUME_PREFIX = 'resumes/'

/** `DeleteObjects` takes at most a thousand keys per request. */
const DELETE_BATCH = 1000

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run against a production environment.')
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL must be set - see apps/api/.env.example')
  process.exit(1)
}

const bucket = process.env.S3_BUCKET
if (!bucket) {
  console.error('S3_BUCKET must be set - see apps/api/.env.example')
  process.exit(1)
}

async function wipeDatabase() {
  const pool = new Pool({ connectionString: databaseUrl, ssl: false })

  try {
    // CASCADE reaches resume_texts, resume_extractions, resumes and its
    // children through their foreign keys.
    await pool.query('truncate table resume_ingestions cascade')

    // pg-boss partitions its job table by queue name; truncating the parent
    // clears every partition. The counters on pgboss.queue go stale for up to
    // a minute - the supervising worker recomputes them from the job table on
    // its next monitor cycle.
    await pool.query('truncate table pgboss.job cascade')

    console.log('Cleared resume_ingestions and pgboss.job')
  } finally {
    await pool.end()
  }
}

async function wipeBucket() {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    // Absent locally is a misconfiguration; absent elsewhere means the SDK's
    // own provider chain, same as the app.
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  })

  try {
    let deleted = 0

    // No continuation token: everything listed is deleted before the next
    // request, so the first page is always the remaining work.
    for (;;) {
      const listed = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: RESUME_PREFIX, MaxKeys: DELETE_BATCH }),
      )

      const keys = (listed.Contents ?? []).map(({ Key }) => ({ Key }))
      if (keys.length === 0) break

      await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }),
      )
      deleted += keys.length
    }

    console.log(`Deleted ${deleted} object(s) under ${bucket}/${RESUME_PREFIX}`)
  } finally {
    client.destroy()
  }
}

await wipeDatabase()
await wipeBucket()
