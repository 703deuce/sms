import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { requireCoordinatorAdmin, coordinatorSweep, coordinatePendingJobs } from '@/lib/server/motion-studio/coordinator'
import { coordinateClipJobs, sweepClipJobs } from '@/lib/server/motion-studio/clip-producer-coordinator'
import { sweepSceneRenders } from '@/lib/server/motion-studio/render-coordinator'
import { sweepDeterministicJobs,coordinateDeterministicJobs } from '@/lib/server/motion-studio/deterministic-jobs'
export async function POST(request: Request) {
  try {
    requireCoordinatorAdmin(request)
    const input = await request.json().catch(() => ({})) as {sweep?:boolean}
    if(input.sweep){
      const jobs=await coordinatorSweep()
      const renders=await sweepSceneRenders()
      const deterministic=await sweepDeterministicJobs()
      return NextResponse.json({jobs,renders,deterministic,clips})
    }
    const [jobs,deterministic,clips]=await Promise.all([
      coordinatePendingJobs(),coordinateDeterministicJobs(),coordinateClipJobs(),
    ])
    return NextResponse.json({jobs,deterministic,clips})
  } catch (error) { return motionStudioJsonError(error) }
}
