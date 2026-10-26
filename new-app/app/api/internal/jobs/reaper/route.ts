import { NextResponse } from 'next/server'
import { reapStaleJobs } from '@/lib/server/clips/jobs'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const count = await reapStaleJobs()
    return NextResponse.json({ data: { requeued: count } })
  } catch (err) {
    console.error('[jobs/reaper]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reaper failed' },
      { status: 500 },
    )
  }
}
