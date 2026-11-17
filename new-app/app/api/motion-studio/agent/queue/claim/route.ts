import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { claimProducerJob } from '@/lib/server/motion-studio/producer-queue'
export async function POST(request: Request) {
  try { return NextResponse.json(await claimProducerJob(request, await request.json())) }
  catch (error) { return motionStudioJsonError(error) }
}
