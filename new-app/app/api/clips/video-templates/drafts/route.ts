import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { TemplateInstanceNotFound } from '@/lib/server/clips/real-video-template-instances'
const schema = z.object({
  releaseId: z.string().min(1).max(80),
  idempotencyKey: z.string().min(8).max(120),
}).strict()
export async function POST(req: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = schema.parse(await req.json())
    const { createVideoTemplateDraft: create } = await import('@/lib/server/clips/video-template-studio-projects')
    return NextResponse.json({ data: await create(workspaceId, body.releaseId, body.idempotencyKey) }, { status: 201 })
  } catch (error) {
    if (error instanceof TemplateInstanceNotFound) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return jsonError(error, 400)
  }
}

/** Mine: workspace-only drafts and published template projects; no community exposure. */
export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const rows = await getPrisma().clipProject.findMany({
      where: { workspaceId, deletedAt: null,
        settings: { path: ['videoTemplateDraft','draft','v'], equals: 1 } },
      select: { id: true, title: true, status: true, updatedAt: true, settings: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    const items = rows.flatMap(row => {
      const settings = row.settings
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return []
      const stored = (settings as Record<string, unknown>).videoTemplateDraft
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return []
      const draft = (stored as Record<string, unknown>).draft
      if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return []
      const releaseId = (draft as Record<string, unknown>).releaseId
      if (typeof releaseId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(releaseId)) return []
      return [{ id: row.id, title: row.title, releaseId, status: row.status,
        updatedAt: row.updatedAt.toISOString() }]
    })
    return NextResponse.json({ data: { items } })
  } catch (error) { return jsonError(error, 500) }
}
