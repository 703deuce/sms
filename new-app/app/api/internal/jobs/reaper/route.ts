import { NextResponse } from 'next/server'
import { reapStaleJobs } from '@/lib/server/clips/jobs'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const count = await reapStaleJobs()
  return NextResponse.json({ data: { requeued: count } })
}
