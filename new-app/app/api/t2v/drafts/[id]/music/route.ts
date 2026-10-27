import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import {
  attachUploadedMusic,
  buildMusicPromptFromDraft,
  enqueueT2vMusicGenerate,
  listT2vProjectMusic,
} from '@/lib/server/t2v/music'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    prompt: z.string().min(8).max(2000).optional(),
    mood: z.string().max(80).optional(),
  }),
  z.object({
    action: z.literal('use'),
    generationId: z.string().min(1),
    label: z.string().optional(),
  }),
  z.object({ action: z.literal('clear') }),
  z.object({ action: z.literal('upload'), uploadId: z.string().min(1) }),
])

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const { id } = await params
  const workspaceId = await resolveWorkspaceId()
  const row = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const tracks = await listT2vProjectMusic(workspaceId, row.projectId)
  const doc = row.document as T2vDraftV1
  return NextResponse.json({
    data: {
      tracks,
      music: doc.music,
      suggestedPrompt: buildMusicPromptFromDraft(doc),
    },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const row = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const doc = row.document as T2vDraftV1

    if (body.action === 'generate') {
      const prompt =
        body.prompt?.trim() ||
        buildMusicPromptFromDraft(doc, body.mood) ||
        'Instrumental background music for a short explainer video'
      const data = await enqueueT2vMusicGenerate(workspaceId, id, prompt)
      const music = doc.music ?? { volume: 0.25, duck: true }
      const next: T2vDraftV1 = {
        ...doc,
        music: {
          ...music,
          disabled: false,
          generationId: data.generationId,
          assetId: data.generationId,
          label: body.mood ?? music.label,
          prompt,
        },
      }
      const saved = await saveT2vDraft(workspaceId, id, row.revision, next)
      return NextResponse.json({ data: { ...data, status: 'PENDING', document: saved.document, revision: saved.revision } })
    }

    if (body.action === 'clear') {
      const next: T2vDraftV1 = { ...doc, music: { volume: 0.25, duck: true, disabled: true } }
      const saved = await saveT2vDraft(workspaceId, id, row.revision, next)
      return NextResponse.json({ data: saved })
    }

    if (body.action === 'upload') {
      const { generationId } = await attachUploadedMusic(workspaceId, id, body.uploadId)
      const music = doc.music ?? { volume: 0.25, duck: true }
      const next: T2vDraftV1 = {
        ...doc,
        music: {
          ...music,
          disabled: false,
          generationId,
          assetId: generationId,
          label: 'Uploaded track',
        },
      }
      const saved = await saveT2vDraft(workspaceId, id, row.revision, next)
      return NextResponse.json({ data: saved })
    }

    const gen = await getPrisma().aiGeneration.findFirst({
      where: { id: body.generationId, workspaceId, kind: 'MUSIC', status: 'READY' },
    })
    if (!gen) return NextResponse.json({ error: 'music_not_ready' }, { status: 400 })
    const music = doc.music ?? { volume: 0.25, duck: true }
    const next: T2vDraftV1 = {
      ...doc,
      music: {
        ...music,
        disabled: false,
        generationId: gen.id,
        assetId: gen.id,
        label: body.label ?? gen.prompt?.slice(0, 48) ?? 'Music',
      },
    }
    const saved = await saveT2vDraft(workspaceId, id, row.revision, next)
    return NextResponse.json({ data: saved })
  } catch (err) {
    return jsonError(err, 400)
  }
}
