import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { registerMachine, registerPlan, registerWorker } from '@/lib/server/motion-studio/coordinator'
import { requireCoordinatorAdmin } from '@/lib/server/motion-studio/coordinator'
import { getPrisma } from '@/lib/server/db'
export async function GET(request:Request){
  try {
    requireCoordinatorAdmin(request)
    const db=getPrisma()
    const [machines,plans,workers,assignments]=await Promise.all([
      db.motionStudioWorkerMachine.findMany({orderBy:{id:'asc'}}),
      db.motionStudioWorkerPlan.findMany({orderBy:{id:'asc'}}),
      db.motionStudioProducerWorker.findMany({
        select:{id:true,name:true,machineId:true,planId:true,capabilities:true,
          maxConcurrent:true,enabled:true,lastSeenAt:true},
        orderBy:{id:'asc'},
      }),
      db.motionStudioWorkerAssignment.findMany({
        where:{status:{in:['reserved','dispatched','running']},leaseExpiresAt:{gt:new Date()}},
        select:{workerId:true,machineId:true,planId:true,workspaceId:true},
      }),
    ])
    return NextResponse.json({machines,plans,workers,activeAssignments:assignments})
  }catch(e){return motionStudioJsonError(e)}
}
export async function POST(request: Request) {
  try {
    const input = await request.json() as {kind?:string}
    if (input.kind === 'machine') return NextResponse.json({ machine:await registerMachine(request,input) })
    if (input.kind === 'plan') return NextResponse.json({ plan:await registerPlan(request,input) })
    if (input.kind === 'worker') return NextResponse.json(await registerWorker(request,input))
    return NextResponse.json({error:'Unknown registry kind'},{status:400})
  } catch(error) { return motionStudioJsonError(error) }
}
