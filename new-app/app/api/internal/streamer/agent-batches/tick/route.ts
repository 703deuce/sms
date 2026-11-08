import 'server-only'
import {NextResponse} from 'next/server'
import {verifyWorkerHmac} from '@/lib/server/clips/worker-auth'
import {tickStreamerAgentBatch} from '@/lib/server/streamer/agent-batch'

/** One bounded orchestration tick per durable worker job. */
export async function POST(request:Request){
  const raw=await request.text()
  if(!verifyWorkerHmac(request,raw))
    return NextResponse.json({error:'unauthorized'},{status:401})
  try{
    const body=JSON.parse(raw) as {projectId?:string;batchId?:string}
    if(!body.projectId||!body.batchId)
      return NextResponse.json({error:'missing_batch_identifiers'},{status:400})
    return NextResponse.json({data:await tickStreamerAgentBatch(body.projectId,body.batchId)})
  }catch(error){
    return NextResponse.json({error:String((error as Error).message).slice(0,250)},
      {status:500})
  }
}
