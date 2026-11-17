import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { updateProducerLease } from '@/lib/server/motion-studio/producer-queue'
export async function POST(request: Request) {
  try { return NextResponse.json(await updateProducerLease(request, await request.json())) }
  catch (error) { return motionStudioJsonError(error) }
}
