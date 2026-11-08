import 'server-only'
import type { Prisma } from '@prisma/client'
import {createId} from '@/lib/supabase/id'
import {getPrisma} from '@/lib/server/db'

/** A durable source project containing only an authorized 20-minute-or-less
 * video section. Never loads the full Twitch/Kick VOD into worker memory. */
export async function createAgentVideoWindow(workspaceId:string,body:{
  parentProjectId:string;rangeStartMs:number;rangeEndMs:number
}){
  const duration=body.rangeEndMs-body.rangeStartMs
  if(!Number.isInteger(body.rangeStartMs)||!Number.isInteger(body.rangeEndMs)||
    duration<15_000||duration>1_200_000)
    throw Error('stream_agent_window_must_be_15_seconds_to_20_minutes')
  const prisma=getPrisma()
  const source=await prisma.clipProject.findFirst({
    where:{id:body.parentProjectId,workspaceId,deletedAt:null,status:'READY'},
    include:{streamVod:{include:{channel:true}},upload:true},
  })
  if(!source?.streamVod||!['twitch','kick'].includes(source.streamVod.platform))
    throw Error('stream_agent_source_not_ready_or_not_twitch_kick')
  const connected=source.streamVod.channel?.status==='CONNECTED'&&
    !source.streamVod.channel?.deletedAt
  if(!source.streamVod.url)throw Error('stream_agent_video_source_missing')
  if(!source.streamVod.attestedAt&&!connected)
    throw Error('stream_agent_original_vod_permission_required')
  if(body.rangeStartMs<source.rangeStartMs||
    body.rangeEndMs>source.rangeEndMs)
    throw Error('stream_agent_window_outside_original_source')
  if(!source.transcriptWords&&!source.transcriptKey)
    throw Error('stream_agent_source_transcript_not_ready')
  const projectId=createId('proj')
  const jobId=createId('job')
  await prisma.$transaction(async tx=>{
    await tx.clipProject.create({data:{
      id:projectId,workspaceId,createdById:source.createdById,
      title:`Agent source · ${source.title} · ${Math.floor(body.rangeStartMs/60_000)}m`,
      settings:JSON.parse(JSON.stringify({
        ...((source.settings??{}) as Record<string,unknown>),
        rangeStartMs:0,rangeEndMs:duration,
        sourceAgentParentProjectId:source.id,
        sourceWindowMs:[body.rangeStartMs,body.rangeEndMs],
      })) as Prisma.InputJsonValue,
      sourceKind:'stream_agent_window',sourceUrl:source.sourceUrl,
      rangeStartMs:0,rangeEndMs:duration,
      status:'PREPARING',stage:'Preparing VOD video window',progress:0,
    }})
    await tx.clipJob.create({data:{
      id:jobId,projectId,type:'STREAM_AGENT_PREPARE',
      status:'QUEUED',priority:10,maxAttempts:2,
      payload:{parentProjectId:source.id,
        rangeStartMs:body.rangeStartMs,rangeEndMs:body.rangeEndMs},
    }})
  })
  return {projectId,jobId,status:'PREPARING' as const}
}
