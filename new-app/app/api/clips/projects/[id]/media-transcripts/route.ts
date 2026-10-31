import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { estimateMediaTranscript, listMediaTranscripts, queueMediaTranscript } from '@/lib/server/clips/media-transcripts'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/**
 * E5b on-demand transcription of the project's own media.
 * GET            → transcripts of this project ({ items })
 * GET ?ref&refId → cost estimate shown before running ({ estimate })
 * POST {ref, refId, acceptedCredits} → queue (refused unless the shown credit cost was accepted)
 */
const refSchema = z.object({ ref: z.enum(['upload', 'take']), refId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/) })

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    if (url.searchParams.get('ref')) {
      const input = refSchema.parse({ ref: url.searchParams.get('ref'), refId: url.searchParams.get('refId') })
      const estimate = await estimateMediaTranscript(workspaceId, projectId, input)
      if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data: { estimate } })
    }
    const items = await listMediaTranscripts(workspaceId, projectId)
    if (!items) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

const postSchema = refSchema.extend({ acceptedCredits: z.number().int().min(0).max(100_000) })

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = postSchema.parse(await request.json())
    const item = await queueMediaTranscript(workspaceId, projectId, body)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { item } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
