import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import type { T2vSceneMedia } from '@/lib/t2v/types'

export async function mediaFromClipUpload(
  workspaceId: string,
  uploadId: string,
  sceneId: string,
): Promise<T2vSceneMedia> {
  const upload = await getPrisma().clipUpload.findFirst({
    where: { id: uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upload?.key) throw new Error('upload_not_ready')

  const storage = getClipStorage()
  const ext = upload.mime.startsWith('image/') ? 'jpg' : 'mp4'
  const destKey = `ws/${workspaceId}/t2v/scenes/${sceneId}/${uploadId}.${ext}`
  const downloadUrl = await storage.createSignedDownloadUrl(upload.key, 3600)
  const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(300_000) })
  if (!res.ok) throw new Error(`upload_copy_${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await storage.putBytes(destKey, buf, upload.mime || (ext === 'jpg' ? 'image/jpeg' : 'video/mp4'))
  const previewUrl = await storage.createSignedDownloadUrl(destKey, 3600)
  const isImage = upload.mime.startsWith('image/')
  return {
    provider: 'upload',
    kind: isImage ? 'image' : 'video',
    assetId: uploadId,
    storageKey: destKey,
    thumbUrl: previewUrl,
    previewUrl,
    width: upload.width ?? undefined,
    height: upload.height ?? undefined,
    durationMs: upload.durationMs ?? undefined,
    focalX: 0.5,
    focalY: 0.5,
    locked: true,
  }
}
