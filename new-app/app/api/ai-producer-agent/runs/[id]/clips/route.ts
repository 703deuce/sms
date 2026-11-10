import {NextResponse} from 'next/server'
import {aiProducerAgentDisabledResponse} from '@/lib/server/ai-producer-agent/api-guard'
import {jsonError} from '@/lib/server/api-error'
import {resolveWorkspaceId} from '@/lib/server/workspace'
import {listUnifiedClipResults} from '@/lib/server/ai-producer-agent/unified-clip-results'

type Params={params:Promise<{id:string}>}

export async function GET(_request:Request,{params}:Params){
  const disabled=aiProducerAgentDisabledResponse()
  if(disabled)return disabled
  try{
    const {id}=await params
    const workspaceId=await resolveWorkspaceId()
    const data=await listUnifiedClipResults(workspaceId,id)
    if(!data)return NextResponse.json({error:'not_found'},{status:404})
    return NextResponse.json({data})
  }catch(err){
    return jsonError(err,500)
  }
}
