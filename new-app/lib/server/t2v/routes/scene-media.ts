import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import { ensureT2vStockAsset } from '@/lib/server/t2v/stock-asset'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { matchScenes, searchT2vStock, toSceneMedia, type StockCandidate } from '@/lib/server/t2v/stock-match'
import type { T2vDraftV1, T2vSceneMedia } from '@/lib/t2v/types'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import { createId } from '@/lib/supabase/id'
import type { T2vSceneAiImagePayload, T2vSceneAiVideoPayload } from '@/lib/t2v/m9-contracts'

function parseDraft(document: unknown): T2vDraftV1 {
  const d = document as T2vDraftV1
  if (!d || d.v !== 1 || !Array.isArray(d.scenes)) throw new Error('invalid_draft')
  return d
}

export async function getSceneMedia(
  draftId: string,
  sceneId: string,
  query: { q?: string; provider?: string; type?: string; page?: string },
) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const workspaceId = await resolveWorkspaceId()
  const row = await getPrisma().t2vDraft.findFirst({ where: { id: draftId, workspaceId } })
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const doc = parseDraft(row.document)
  const scene = doc.scenes.find((s) => s.id === sceneId)
  if (!scene) return NextResponse.json({ error: 'scene_not_found' }, { status: 404 })

  const q = (query.q ?? scene.visualQuery).trim()
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const sources = doc.settings.mediaSources.filter((p): p is 'pexels' | 'pixabay' => p !== 'ai_image')
  const filtered =
    query.provider === 'pexels'
      ? sources.filter((s) => s === 'pexels')
      : query.provider === 'pixabay'
        ? sources.filter((s) => s === 'pixabay')
        : sources

  const mediaType = query.type === 'photo' ? 'photo' : 'video'
  const candidates = await searchT2vStock({
    query: q,
    aspect: doc.settings.aspect,
    sources: filtered.length ? filtered : sources,
    page,
    keywords: scene.keywords,
    needMs: estimateSceneMs(scene),
    mediaType,
  })

  return NextResponse.json({ data: { candidates } })
}

const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('replace'),
    media: z.object({ provider: z.enum(['pexels', 'pixabay']), providerId: z.string() }).passthrough(),
  }),
  z.object({ action: z.literal('shuffle') }),
  z.object({ action: z.literal('upload'), uploadId: z.string() }),
  z.object({ action: z.literal('ai_image'), prompt: z.string().min(3) }),
  z.object({ action: z.literal('ai_video'), prompt: z.string().min(3) }),
])

export async function postSceneMedia(draftId: string, sceneId: string, request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const row = await getPrisma().t2vDraft.findFirst({ where: { id: draftId, workspaceId } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const doc = parseDraft(row.document)
    const idx = doc.scenes.findIndex((s) => s.id === sceneId)
    if (idx < 0) return NextResponse.json({ error: 'scene_not_found' }, { status: 404 })
    const scene = doc.scenes[idx]
    const body = postSchema.parse(await request.json())

    if (body.action === 'upload') {
      return NextResponse.json({ error: 'not_implemented', action: body.action }, { status: 501 })
    }

    if (body.action === 'ai_image' || body.action === 'ai_video') {
      const jobType = body.action === 'ai_image' ? 'T2V_SCENE_AI_IMAGE' : 'T2V_SCENE_AI_VIDEO'
      const base: T2vSceneAiImagePayload = {
        workspaceId,
        draftId,
        sceneId,
        prompt: body.prompt,
        aspect: doc.settings.aspect,
      }
      const payload: T2vSceneAiImagePayload | T2vSceneAiVideoPayload = base
      const jobId = createId('job')
      await getPrisma().clipJob.create({
        data: {
          id: jobId,
          projectId: row.projectId,
          type: jobType,
          status: 'QUEUED',
          payload,
        },
      })
      return NextResponse.json({ data: { jobId, status: 'queued' } }, { status: 202 })
    }

    let pick: StockCandidate | null = null
    if (body.action === 'shuffle') {
      const sources = doc.settings.mediaSources.filter((p): p is 'pexels' | 'pixabay' => p !== 'ai_image')
      const matched = await matchScenes({
        scenes: [
          {
            id: scene.id,
            visualQuery: scene.visualQuery,
            keywords: scene.keywords,
            needMs: estimateSceneMs(scene),
          },
        ],
        aspect: doc.settings.aspect,
        sources,
      })
      const alt = matched[scene.id]?.alternates?.[0] ?? matched[scene.id]?.pick
      pick = alt ?? null
    } else {
      const m = body.media as StockCandidate & T2vSceneMedia
      if (m.srcUrl && m.provider && m.providerId) {
        pick = m as StockCandidate
      } else {
        const hits = await searchT2vStock({
          query: scene.visualQuery,
          aspect: doc.settings.aspect,
          sources: [body.media.provider],
          page: 1,
          keywords: scene.keywords,
          needMs: estimateSceneMs(scene),
        })
        pick = hits.find((h) => h.providerId === body.media.providerId) ?? null
        if (!pick) {
          const photos = await searchT2vStock({
            query: scene.visualQuery,
            aspect: doc.settings.aspect,
            sources: [body.media.provider],
            page: 1,
            keywords: scene.keywords,
            needMs: estimateSceneMs(scene),
            mediaType: 'photo',
          })
          pick = photos.find((h) => h.providerId === body.media.providerId) ?? null
        }
      }
    }

    if (!pick) return NextResponse.json({ error: 'no_match' }, { status: 404 })
    const asset = await ensureT2vStockAsset(workspaceId, pick)
    const media: T2vSceneMedia = {
      ...toSceneMedia(pick, asset.id, estimateSceneMs(scene), scene.visualQuery),
      locked: true,
    }
    doc.scenes[idx] = { ...scene, media }
    const saved = await saveT2vDraft(workspaceId, draftId, row.revision, doc)
    return NextResponse.json({ data: { ...saved, scene: doc.scenes[idx] } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
