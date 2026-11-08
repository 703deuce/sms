import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createId } from '@/lib/supabase/id'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { jsonError } from '@/lib/server/api-error'

const requestSchema=z.object({
  parentProjectId:z.string().min(1),
  rangeStartMs:z.number().int().min(0),
  rangeEndMs:z.number().int().min(1),
})

/** Prepare a VIDEO source from an authorized audio-first streamer VOD.
 * A bounded job downloads only requested original footage. It cannot
 * download an entire multi-hour recording or consume arbitrary URLs. */
export async function POST(request:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const body=requestSchema.parse(await request.json())
    const duration=body.rangeEndMs-body.rangeStartMs
    if(duration<15_000||duration>1_200_000)
      throw Error('stream_agent_window_must_be_15_seconds_to_20_minutes')
    const prisma=getPrisma()
    const source=await prisma.clipProject.findFirst({
      where:{id:body.parentProjectId,workspaceId,deletedAt:null,status:'READY'},
      include:{streamVod:true,upload:true},
    })
    if(!source?.streamVod||!['twitch','kick'].includes(source.streamVod.platform))
      throw Error('stream_agent_source_not_ready_or_not_twitch_kick')
    if(!source.streamVod.url||!source.streamVod.attestedAt)
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
        settings:{sourceAgentParentProjectId:source.id,
          sourceWindowMs:[body.rangeStartMs,body.rangeEndMs]},
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
    return NextResponse.json({data:{projectId,jobId,status:'PREPARING'}})
  }catch(err){return jsonError(err,400)}
}

export async function GET(request:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const projectId=new URL(request.url).searchParams.get('projectId')??''
    if(!projectId)return NextResponse.json({error:'projectId_required'},{status:400})
    const project=await getPrisma().clipProject.findFirst({
      where:{id:projectId,workspaceId,deletedAt:null,sourceKind:'stream_agent_window'},
      select:{id:true,status:true,error:true,rangeStartMs:true,rangeEndMs:true,
        uploadId:true,jobs:{where:{type:'STREAM_AGENT_PREPARE'},
          select:{status:true,error:true},take:1,orderBy:{createdAt:'desc'}}},
    })
    if(!project)return NextResponse.json({error:'not_found'},{status:404})
    return NextResponse.json({data:{
      projectId:project.id,status:project.status,
      ready:project.status==='READY'&&Boolean(project.uploadId),
      durationMs:project.rangeEndMs,
      error:project.error??project.jobs[0]?.error??null,
      jobStatus:project.jobs[0]?.status??null,
    }})
  }catch(err){return jsonError(err,400)}
}
