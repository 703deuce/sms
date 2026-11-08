import { NextResponse } from 'next/server'
import { aiProducerAgentDisabledResponse } from '@/lib/server/ai-producer-agent/api-guard'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** Only workspace-owned uploads with real source video and transcribed
 * records are offered for the three-video experiment. */
export async function GET(){
  const disabled=aiProducerAgentDisabledResponse()
  if(disabled)return disabled
  try{
    const workspaceId=await resolveWorkspaceId()
    const rows=await getPrisma().clipProject.findMany({
      where:{workspaceId,deletedAt:null,uploadId:{not:null},
        upload:{status:'COMPLETE',mime:{startsWith:'video/'}}},
      select:{id:true,title:true,rangeStartMs:true,rangeEndMs:true,
        transcriptWords:true,upload:{select:{durationMs:true}}},
      orderBy:{updatedAt:'desc'},take:100,
    })
    return NextResponse.json({data:{sources:rows.map(p=>({
      projectId:p.id,title:p.title,
      durationMs:p.upload?.durationMs??(p.rangeEndMs-p.rangeStartMs),
      hasTranscript:Array.isArray(p.transcriptWords)&&p.transcriptWords.length>=30,
    })).filter(p=>p.hasTranscript)}})
  }catch(error){return jsonError(error,500)}
}
