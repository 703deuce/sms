import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isTrackUploadApiEnabled } from '@/lib/server/recording/solo-recording-gate'
import { startRecordingTake, stopRecordingTake } from '@/lib/server/recording/takes'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const startSchema = z.object({
  action: z.literal('start'),
  startAtHostMs: z.number().int().nonnegative(),
})

const stopSchema = z.object({
  action: z.literal('stop'),
  takeId: z.string().min(8),
  stopAtHostMs: z.number().int().nonnegative(),
})

export async function POST(request: Request, { params }: Params) {
  try {
    if (!isTrackUploadApiEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id: sessionId } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json()
    const start = startSchema.safeParse(body)
    if (start.success) {
      const take = await startRecordingTake(sessionId, workspaceId, start.data.startAtHostMs)
      if (!take) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({
        data: {
          takeId: take.id,
          index: take.index,
          startAtHostMs: Number(take.startAtHostMs),
        },
      })
    }
    const stop = stopSchema.safeParse(body)
    if (stop.success) {
      const take = await stopRecordingTake(
        sessionId,
        workspaceId,
        stop.data.takeId,
        stop.data.stopAtHostMs,
      )
      if (!take) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data: { takeId: take.id, stopped: true } })
    }
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  } catch (err) {
    return jsonError(err, 500)
  }
}
