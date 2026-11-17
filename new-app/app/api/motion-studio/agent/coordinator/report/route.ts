import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { reportWorkerProgress } from '@/lib/server/motion-studio/coordinator'
export async function POST(request: Request) {
  try { return NextResponse.json(await reportWorkerProgress(request,await request.json())) }
  catch(error) { return motionStudioJsonError(error) }
}
