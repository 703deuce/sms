#!/usr/bin/env node
/**
 * Create private Supabase bucket `clips` (idempotent). Requires service role key in env.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/ensure-clips-storage-bucket.mjs
 */
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const bucketId = process.env.STORAGE_BUCKET || process.env.CLIPS_STORAGE_BUCKET || 'clips'
const fiveGb = 5 * 1024 * 1024 * 1024

if (!url || !key) {
  console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${key}`,
  apikey: key,
  'Content-Type': 'application/json',
}

async function listBuckets() {
  const res = await fetch(`${url}/storage/v1/bucket`, { headers })
  if (!res.ok) throw new Error(`list buckets failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function createBucket(fileSizeLimit) {
  const body = {
    id: bucketId,
    name: bucketId,
    public: false,
    file_size_limit: fileSizeLimit,
  }
  const res = await fetch(`${url}/storage/v1/bucket`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (res.status === 409) return { created: false, fileSizeLimit }
  if (!res.ok) throw new Error(`create bucket failed: ${res.status} ${await res.text()}`)
  return { created: true, fileSizeLimit }
}

async function main() {
  const existing = await listBuckets()
  const found = Array.isArray(existing) && existing.find((b) => b.id === bucketId || b.name === bucketId)
  if (found) {
    console.log(`Bucket "${bucketId}" already exists (file_size_limit=${found.file_size_limit ?? 'default'})`)
    return
  }
  let limit = fiveGb
  try {
    const out = await createBucket(limit)
    console.log(`Created bucket "${bucketId}" (file_size_limit=${out.fileSizeLimit})`)
  } catch (err) {
    const msg = String(err)
    if (msg.includes('file_size_limit') || msg.includes('413') || msg.includes('400')) {
      limit = 50 * 1024 * 1024
      const out = await createBucket(limit)
      console.log(`Created bucket "${bucketId}" with fallback limit ${limit} bytes`)
      console.warn('Could not set 5GB limit; note cap in docs/clips/PROGRESS.md')
    } else {
      throw err
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
