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
import { mediaFromClipUpload } from '@/lib/server/t2v/upload-scene-media'
import { assertValidT2vSceneId } from '@/lib/server/t2v/scene-id'
import type { T2vSceneAiImagePayload, T2vSceneAiVideoPayload } from '@/lib/t2v/m9-contracts'
import { logT2v, logT2vError } from '@/lib/server/t2v/log'

const stockCandidateBody = z.object({
  provider: z.enum(['pixabay', 'pexels', 'pexels_photo']),
  providerId: z.union([z.string(), z.number()]).transform(String),
  thumbUrl: z.string().optional(),
  previewUrl: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationS: z.number().optional(),
  srcUrl: z.string().url(),
  pageUrl: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  stockKind: z.enum(['video', 'photo']).optional(),
})

function candidateFromBody(c: z.infer<typeof stockCandidateBody>): StockCandidate {
  return {
    provider: c.provider,
    providerId: c.providerId,
    width: c.width ?? 1280,
    height: c.height ?? 720,
    durationS: c.durationS ?? 10,
    thumbUrl: c.thumbUrl ?? '',
    previewUrl: c.previewUrl ?? c.thumbUrl ?? '',
    srcUrl: c.srcUrl,
    pageUrl: c.pageUrl ?? '',
    author: c.author ?? '',
    tags: c.tags ?? [],
    score: 0,
    stockKind: c.stockKind,
  }
}

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
  assertValidT2vSceneId(sceneId)
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
    videoTopic: doc.title,
  })

  return NextResponse.json({ data: { candidates } })
}

const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('replace'),
    media: z.object({
      provider: z.enum(['pexels', 'pixabay', 'pexels_photo']),
      providerId: z.string(),
      stockKind: z.enum(['video', 'photo']).optional(),
    }),
    query: z.string().max(500).optional(),
    page: z.number().int().min(1).optional(),
    candidate: stockCandidateBody.optional(),
  }),
  z.object({ action: z.literal('shuffle') }),
  z.object({ action: z.literal('upload'), uploadId: z.string() }),
  z.object({
    action: z.literal('focal'),
    focalX: z.number().min(0).max(1),
    focalY: z.number().min(0).max(1),
  }),
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
      const media = await mediaFromClipUpload(workspaceId, body.uploadId, sceneId)
      doc.scenes[idx] = { ...scene, media }
      const saved = await saveT2vDraft(workspaceId, draftId, row.revision, doc)
      return NextResponse.json({ data: { ...saved, scene: doc.scenes[idx] } })
    }

    if (body.action === 'focal') {
      doc.scenes[idx] = {
        ...scene,
        media: { ...scene.media, focalX: body.focalX, focalY: body.focalY },
      }
      const saved = await saveT2vDraft(workspaceId, draftId, row.revision, doc)
      return NextResponse.json({ data: { ...saved, scene: doc.scenes[idx] } })
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
    let appliedQuery = scene.visualQuery
    if (body.action === 'shuffle') {
      const sources = doc.settings.mediaSources.filter((p): p is 'pexels' | 'pixabay' => p !== 'ai_image')
      const { byScene: matched } = await matchScenes({
        scenes: [
          {
            id: scene.id,
            visualQuery: scene.visualQuery,
            keywords: scene.keywords,
            needMs: estimateSceneMs(scene),
            narration: scene.narration,
          },
        ],
        aspect: doc.settings.aspect,
        sources,
        videoTopic: doc.title,
        workspaceId,
        projectId: row.projectId,
        sceneIndexOffset: doc.scenes.findIndex((sc) => sc.id === scene.id),
      })
      const alt = matched[scene.id]?.alternates?.[0] ?? matched[scene.id]?.pick
      pick = alt ?? null
    } else if (body.candidate?.srcUrl) {
      pick = candidateFromBody(body.candidate)
      appliedQuery = (body.query ?? scene.visualQuery).trim()
      logT2v('scene-media', 'apply stock from client candidate', {
        draftId,
        sceneId,
        provider: pick.provider,
        providerId: pick.providerId,
      })
    } else {
      const q = (body.query ?? scene.media.query ?? scene.visualQuery).trim()
      appliedQuery = q
      const page = body.page ?? 1
      const provider =
        body.media.provider === 'pexels_photo' ? 'pexels' : body.media.provider
      const mediaType =
        body.media.stockKind === 'photo' || body.media.provider === 'pexels_photo' ? 'photo' : 'video'
      const wantId = String(body.media.providerId)
      const hits = await searchT2vStock({
        query: q,
        aspect: doc.settings.aspect,
        sources: [provider],
        page,
        keywords: scene.keywords,
        needMs: estimateSceneMs(scene),
        mediaType,
        videoTopic: doc.title,
      })
      pick = hits.find((h) => String(h.providerId) === wantId) ?? null
      if (!pick) {
        logT2v('scene-media', 'stock pick not in search results, retry alt mediaType', {
          draftId,
          sceneId,
          provider,
          providerId: wantId,
          mediaType,
        })
        const alt = mediaType === 'photo' ? 'video' : 'photo'
        const hits2 = await searchT2vStock({
          query: q,
          aspect: doc.settings.aspect,
          sources: [provider],
          page,
          keywords: scene.keywords,
          needMs: estimateSceneMs(scene),
          mediaType: alt,
          videoTopic: doc.title,
        })
        pick = hits2.find((h) => String(h.providerId) === wantId) ?? null
      }
    }

    if (!pick) {
      logT2v('scene-media', 'no_match for stock replace', { draftId, sceneId })
      return NextResponse.json({ error: 'no_match' }, { status: 404 })
    }
    let asset
    try {
      asset = await ensureT2vStockAsset(workspaceId, pick)
    } catch (err) {
      logT2vError('scene-media', 'ensureT2vStockAsset failed', err, {
        draftId,
        sceneId,
        provider: pick.provider,
        providerId: pick.providerId,
      })
      throw err
    }
    logT2v('scene-media', 'stock applied to scene', {
      draftId,
      sceneId,
      assetId: asset.id,
      provider: pick.provider,
      providerId: pick.providerId,
    })
    const media: T2vSceneMedia = {
      ...toSceneMedia(pick, asset.id, estimateSceneMs(scene), appliedQuery),
      locked: true,
      query: appliedQuery,
    }
    doc.scenes[idx] = { ...scene, media }
    const saved = await saveT2vDraft(workspaceId, draftId, row.revision, doc)
    return NextResponse.json({ data: { ...saved, scene: doc.scenes[idx] } })
  } catch (err) {
    logT2vError('scene-media', 'postSceneMedia failed', err, { draftId, sceneId })
    return jsonError(err, 400)
  }
}
