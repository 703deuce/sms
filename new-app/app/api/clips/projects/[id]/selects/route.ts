import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  addProjectSelectFromHit,
  clearProjectSelects,
  listProjectSelects,
  removeProjectSelect,
} from '@/lib/server/clips/project-selects'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import type { SpeechSearchHit } from '@/lib/clips/editor/speech-search'

async function assertProject(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  return prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null }, select: { id: true } })
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    if (!(await assertProject(workspaceId, projectId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const items = await listProjectSelects(workspaceId, projectId)
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    hit: z.object({
      sourceId: z.string(),
      kind: z.enum(['main', 'upload', 'take']),
      label: z.string(),
      startS: z.number(),
      endS: z.number(),
      snippet: z.string(),
    }),
  }),
  z.object({ action: z.literal('clear') }),
])

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    if (!(await assertProject(workspaceId, projectId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const body = postSchema.parse(await request.json())
    if (body.action === 'clear') {
      await clearProjectSelects(workspaceId, projectId)
      return NextResponse.json({ data: { ok: true, items: [] } })
    }
    const { row, duplicate } = await addProjectSelectFromHit(
      workspaceId,
      projectId,
      body.hit as SpeechSearchHit,
    )
    const items = await listProjectSelects(workspaceId, projectId)
    return NextResponse.json({ data: { row, duplicate, items } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    if (!(await assertProject(workspaceId, projectId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const url = new URL(request.url)
    const selectId = url.searchParams.get('selectId')
    if (!selectId) return NextResponse.json({ error: 'selectId required' }, { status: 400 })
    const ok = await removeProjectSelect(workspaceId, projectId, selectId)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const items = await listProjectSelects(workspaceId, projectId)
    return NextResponse.json({ data: { ok: true, items } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
