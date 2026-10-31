import 'server-only'

import { editorAssetKeys, type EditorAssets } from '@/lib/clips/editor/editor-assets'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import type { ClipStorageDriver } from '@/lib/storage/types'

/** FV2: sign the full-video peaks + filmstrip keys stored on clip.aiMeta.editorAssets. */
export async function resolveEditorAssets(
  storage: ClipStorageDriver,
  aiMeta: unknown,
): Promise<EditorAssets> {
  const k = editorAssetKeys(aiMeta)
  const sign = (key: string) => createCachedSignedDownloadUrl(storage, key).catch(() => null)
  const [peaksUrl, sheetUrls] = await Promise.all([
    k.peaksKey ? sign(k.peaksKey) : Promise.resolve(null),
    k.filmstrip ? Promise.all(k.filmstrip.keys.map(sign)) : Promise.resolve([] as (string | null)[]),
  ])
  let filmstrip: EditorAssets['filmstrip'] = null
  if (k.filmstrip && sheetUrls.length && sheetUrls.every((u): u is string => typeof u === 'string')) {
    const { keys: _k, ...layout } = k.filmstrip
    filmstrip = { ...layout, sheetUrls: sheetUrls as string[] }
  }
  return { fullVideo: k.fullVideo, peaksUrl, filmstrip }
}
