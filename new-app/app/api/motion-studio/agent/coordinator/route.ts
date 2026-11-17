import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { requireCoordinatorAdmin, coordinatorSweep, coordinatePendingJobs } from '@/lib/server/motion-studio/coordinator'
import { sweepSceneRenders } from '@/lib/server/motion-studio/render-coordinator'
export async function POST(request: Request) {
  try {
    requireCoordinatorAdmin(request)
    const input = await request.json().catch(() => ({})) as {sweep?:boolean}
    if(input.sweep){
      const jobs=await coordinatorSweep()
      const renders=await sweepSceneRenders()
      return NextResponse.json({jobs,renders})
    }
    return NextResponse.json(await coordinatePendingJobs())
  } catch (error) { return motionStudioJsonError(error) }
}
