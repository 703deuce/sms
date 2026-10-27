// POST: (re)write the script with the LLM -> scenes[]. Sync (~5-15 s); UI shows "Writing script" skeleton.
import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { writeScript } from '@/lib/server/t2v/script-llm'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import { scenesFromLlm, sourceTextOf } from '@/lib/t2v/defaults'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = await resolveWorkspaceId()
  const d = await getPrisma().t2vDraft.findFirstOrThrow({ where: { id, workspaceId } })
  const doc = d.document as any
  const out = await writeScript({ sourceKind: doc.source.kind, sourceText: await sourceTextOf(doc.source), settings: doc.settings })
  const next = { ...doc, title: doc.title || out.title, scenes: scenesFromLlm(out.scenes, doc), nextSlot: out.scenes.length }
  return NextResponse.json({ data: await saveT2vDraft(workspaceId, id, d.revision, next) })
}
