import 'server-only'
import { Readable } from 'stream'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'

/** Server-side copy within clip storage (streamed, no full-file buffer in app memory). */
export async function copyClipStorageObject(srcKey: string, destKey: string, contentType: string) {
  const storage = await getClipStorageForObjectKey(srcKey)
  const downloadUrl = await storage.createSignedDownloadUrl(srcKey, 600)
  const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(300_000) })
  if (!res.ok || !res.body) throw new Error(`storage_copy_${res.status}`)
  const dest = getClipStorage()
  const body = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
  await dest.putStream(destKey, body, contentType)
}
