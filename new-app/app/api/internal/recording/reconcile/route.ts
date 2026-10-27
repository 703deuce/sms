import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { reconcileRecordingSessions } from '@/lib/server/livekit/reconcile'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await reconcileRecordingSessions()
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 500)
  }
}
