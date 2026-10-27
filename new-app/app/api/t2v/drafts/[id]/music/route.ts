import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { enqueueT2vMusicGenerate } from '@/lib/server/t2v/music'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate'),
    prompt: z.string().min(8).max(2000),
  }),
  z.object({
    action: z.literal('use'),
    generationId: z.string().min(1),
    label: z.string().optional(),
  }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())

    if (body.action === 'generate') {
      const data = await enqueueT2vMusicGenerate(workspaceId, id, body.prompt)
      return NextResponse.json({ data: { ...data, status: 'PENDING' } })
    }

    const row = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const gen = await getPrisma().aiGeneration.findFirst({
      where: { id: body.generationId, workspaceId, kind: 'MUSIC', status: 'READY' },
    })
    if (!gen) return NextResponse.json({ error: 'music_not_ready' }, { status: 400 })
    const doc = row.document as T2vDraftV1
    const music = doc.music ?? { volume: 0.25, duck: true }
    const next: T2vDraftV1 = {
      ...doc,
      music: {
        ...music,
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
