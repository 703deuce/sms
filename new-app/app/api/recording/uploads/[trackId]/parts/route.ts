import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { beginRecordingTrackUpload, recordRecordingTrackPart } from '@/lib/server/recording/uploads'
import { presignRecordingTrackPart } from '@/lib/server/recording/presign-part'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ trackId: string }> }

const initSchema = z.object({
  action: z.literal('init'),
  sessionId: z.string().min(8),
  bytesExpected: z.number().int().positive(),
  mimeType: z.string().min(3),
})

const presignSchema = z.object({
  action: z.literal('presign'),
  partNumber: z.number().int().positive(),
})

const partSchema = z.object({
  action: z.literal('part'),
  partNumber: z.number().int().positive(),
  etag: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
  chunkSeqFrom: z.number().int().nonnegative().optional(),
  chunkSeqTo: z.number().int().nonnegative().optional(),
})

export async function POST(request: Request, { params }: Params) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { trackId } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json()
    const init = initSchema.safeParse(body)
    if (init.success) {
      const result = await beginRecordingTrackUpload({
        workspaceId,
        sessionId: init.data.sessionId,
        trackId,
        bytesExpected: init.data.bytesExpected,
        mimeType: init.data.mimeType,
      })
      return NextResponse.json({ data: result })
    }
    const presign = presignSchema.safeParse(body)
    if (presign.success) {
      const result = await presignRecordingTrackPart(workspaceId, trackId, presign.data.partNumber)
      return NextResponse.json({ data: result })
    }
    const part = partSchema.safeParse(body)
    if (part.success) {
      const result = await recordRecordingTrackPart(
        workspaceId,
        trackId,
        part.data.partNumber,
        part.data.etag,
        part.data.sizeBytes,
        part.data.chunkSeqFrom != null && part.data.chunkSeqTo != null
          ? { from: part.data.chunkSeqFrom, to: part.data.chunkSeqTo }
          : undefined,
      )
      return NextResponse.json({ data: result })
    }
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  } catch (err) {
    return jsonError(err, 500)
  }
}
