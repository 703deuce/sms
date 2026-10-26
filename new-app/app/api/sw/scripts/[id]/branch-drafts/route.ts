import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'
import { branchMergeSuggestions } from '@/lib/screenwriting/branch/merge'
import type { JSONContent } from '@tiptap/core'

const postSchema = z.object({ label: z.string().min(1) })

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const script = await getScriptForOwner(id, actor.id)
    if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const drafts = await getPrisma().swBranchDraft.findMany({ where: { scriptId: id }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ data: drafts })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const script = await getScriptForOwner(id, actor.id)
    if (!script?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = postSchema.parse(await request.json())
    const row = await getPrisma().swBranchDraft.create({
      data: { scriptId: id, label: body.label, pmJson: script.pmJson },
    })
    return NextResponse.json({ data: row })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const script = await getScriptForOwner(id, actor.id)
    if (!script?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { draftId } = z.object({ draftId: z.string() }).parse(await request.json())
    const draft = await getPrisma().swBranchDraft.findFirst({ where: { id: draftId, scriptId: id } })
    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const suggestions = branchMergeSuggestions(script.pmJson as JSONContent, draft.pmJson as JSONContent)
    return NextResponse.json({ data: { suggestions } })
  } catch (e) {
    return jsonError(e, 400)
  }
}
