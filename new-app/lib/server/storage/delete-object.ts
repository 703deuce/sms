import 'server-only'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { getPrisma } from '@/lib/server/db'
import { storageDriverName } from '@/lib/storage'
import { getS3Client, getS3Config } from '@/lib/storage/s3'
import { getSupabaseStorageConfig } from '@/lib/storage/supabase-driver'

/** Best-effort delete when no clip_upload rows reference the object key. */
export async function deleteClipStorageObjectIfOrphan(objectKey: string, driverHint?: string | null) {
  const prisma = getPrisma()
  const refs = await prisma.clipUpload.count({ where: { key: objectKey } })
  if (refs > 0) return

  const driver = (driverHint?.trim().toLowerCase() || storageDriverName()) as string
  if (driver === 's3' || driver === 'r2') {
    const cfg = getS3Config()
    if (!cfg) return
    await getS3Client(cfg, { internal: true }).send(
      new DeleteObjectCommand({ Bucket: cfg.bucket, Key: objectKey }),
    )
    return
  }
  const supa = getSupabaseStorageConfig()
  if (!supa) return
  const supabase = createClient(supa.url, supa.key, { auth: { persistSession: false } })
  await supabase.storage.from(supa.bucket).remove([objectKey])
}
