import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import { rewriteScriptFromDraft, writeScript } from '@/lib/server/t2v/script-llm'
import { mergeLlmIntoScenes, scenesFromLlm, sourceTextOf } from '@/lib/t2v/defaults'
import { logT2v, logT2vError } from '@/lib/server/t2v/log'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const { id } = await params
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = z.object({ instruction: z.string().optional() }).parse(await request.json().catch(() => ({})))
    const d = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
    if (!d) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const doc = d.document as T2vDraftV1
    const instruction = body.instruction?.trim()
    let out
    if (instruction && doc.scenes.length > 0) {
      logT2v('script-rewrite', 'quick rewrite from current scenes', {
        draftId: id,
        sceneCount: doc.scenes.length,
        instruction,
      })
      out = await rewriteScriptFromDraft({
        instruction,
        settings: doc.settings,
        title: doc.title,
        scenes: doc.scenes.map((s) => ({
          narration: s.narration,
          onScreenText: s.onScreenText,
          visualQuery: s.visualQuery,
          keywords: s.keywords,
        })),
      })
    } else {
      const sourceText = (await sourceTextOf(doc.source)) + (instruction ? `\n\nInstruction: ${instruction}` : '')
      logT2v('script-rewrite', 'generate script from source', { draftId: id, sourceKind: doc.source.kind })
      out = await writeScript({ sourceKind: doc.source.kind, sourceText, settings: doc.settings })
    }
    const scenes =
      instruction && doc.scenes.length > 0 ? mergeLlmIntoScenes(out.scenes, doc) : scenesFromLlm(out.scenes, doc)
    const next: T2vDraftV1 = {
      ...doc,
      title: doc.title || out.title,
      scenes,
      nextSlot: Math.max(doc.nextSlot, scenes.length),
    }
    return NextResponse.json({ data: await saveT2vDraft(workspaceId, id, d.revision, next) })
  } catch (err) {
    logT2vError('script-rewrite', 'script POST failed', err, { draftId: id })
    return jsonError(err, 400)
  }
}
