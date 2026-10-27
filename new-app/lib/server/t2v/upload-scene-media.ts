import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { copyClipStorageObject } from '@/lib/server/storage/copy-object'
import { assertValidT2vSceneId } from '@/lib/server/t2v/scene-id'
import type { T2vSceneMedia } from '@/lib/t2v/types'

export async function mediaFromClipUpload(
  workspaceId: string,
  uploadId: string,
  sceneId: string,
): Promise<T2vSceneMedia> {
  assertValidT2vSceneId(sceneId)
  const upload = await getPrisma().clipUpload.findFirst({
    where: { id: uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upload?.key) throw new Error('upload_not_ready')
  if (upload.mime.startsWith('audio/')) {
    throw new Error('upload_must_be_image_or_video')
  }

  const ext = upload.mime.startsWith('image/') ? 'jpg' : 'mp4'
  const destKey = `ws/${workspaceId}/t2v/scenes/${sceneId}/${uploadId}.${ext}`
  const contentType = upload.mime || (ext === 'jpg' ? 'image/jpeg' : 'video/mp4')
  await copyClipStorageObject(upload.key, destKey, contentType, upload.storageDriver)

  const isImage = upload.mime.startsWith('image/')
  return {
    provider: 'upload',
    kind: isImage ? 'image' : 'video',
    assetId: uploadId,
    storageKey: destKey,
    width: upload.width ?? undefined,
    height: upload.height ?? undefined,
    durationMs: upload.durationMs ?? undefined,
    focalX: 0.5,
    focalY: 0.5,
    locked: true,
  }
}
