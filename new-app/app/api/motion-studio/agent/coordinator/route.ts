import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { requireCoordinatorAdmin, coordinatorSweep, coordinatePendingJobs } from '@/lib/server/motion-studio/coordinator'
export async function POST(request: Request) {
  try {
    requireCoordinatorAdmin(request)
    const input = await request.json().catch(() => ({})) as {sweep?:boolean}
    return NextResponse.json(input.sweep ? await coordinatorSweep() : await coordinatePendingJobs())
  } catch (error) { return motionStudioJsonError(error) }
}
