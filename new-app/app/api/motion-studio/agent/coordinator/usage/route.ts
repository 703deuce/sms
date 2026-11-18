import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { reportWorkerUsage } from '@/lib/server/motion-studio/coordinator'
export async function POST(request: Request) {
  try { return NextResponse.json(await reportWorkerUsage(request,await request.json())) }
  catch(error) { return motionStudioJsonError(error) }
}
