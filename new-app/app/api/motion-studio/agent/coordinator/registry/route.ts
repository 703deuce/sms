import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { registerMachine, registerPlan, registerWorker } from '@/lib/server/motion-studio/coordinator'
export async function POST(request: Request) {
  try {
    const input = await request.json() as {kind?:string}
    if (input.kind === 'machine') return NextResponse.json({ machine:await registerMachine(request,input) })
    if (input.kind === 'plan') return NextResponse.json({ plan:await registerPlan(request,input) })
    if (input.kind === 'worker') return NextResponse.json(await registerWorker(request,input))
    return NextResponse.json({error:'Unknown registry kind'},{status:400})
  } catch(error) { return motionStudioJsonError(error) }
}
