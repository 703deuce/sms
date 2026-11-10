import 'server-only'

import { createHash } from 'crypto'
import type { Prisma } from '@prisma/client'
import { editsVersionHash, type ClipEditsV2 } from '@/lib/clips/edits'
import { exportPixelSize, renderVersionHash } from '@/lib/clips/export-aspect'
import { clipRenderHashMaterial } from '@/lib/clips/render-cache-key'
import { resolveComposeSpec } from '@/lib/clips/compose-spec'
import { composeSpecV1Enabled } from '@/lib/clips/compose-spec-flags'
import { getPrisma } from '@/lib/server/db'
import { exportFilename } from '@/lib/server/clips/clips'
import { parseSettings } from '@/lib/server/clips/projects'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

export type YoutubeOutputIdentity = {
  projectId: string
  clipId: string
  renderId: string
  jobId: string
}

export function youtubeOutputIdentity(workspaceId:string,runId:string,optionId:string):YoutubeOutputIdentity{
  const token=createHash('sha256').update(workspaceId).update('\0').update(runId).update('\0').update(optionId)
    .digest('hex').slice(0,32)
  return {
    projectId:`ytproj_${token}`,
    clipId:`ytclip_${token}`,
    renderId:`ytrnd_${token}`,
    jobId:`ytjob_${token}`,
  }
}

export async function createOrReuseYoutubeOutputProject(a:{
  workspaceId:string;createdById:string;runId:string;optionId:string;title:string;
  sourceProjectId:string;clipStartMs:number;clipEndMs:number
}):Promise<YoutubeOutputIdentity>{
  const prisma=getPrisma()
  const ids=youtubeOutputIdentity(a.workspaceId,a.runId,a.optionId)
  const source=await prisma.clipProject.findFirstOrThrow({
    where:{id:a.sourceProjectId,workspaceId:a.workspaceId,deletedAt:null},
  })
  const sourceSettings=source.settings&&typeof source.settings==='object'&&!Array.isArray(source.settings)
    ?source.settings as Record<string,unknown>:{}
  const settings:Record<string,unknown>={
    ...sourceSettings,...parseSettings(sourceSettings,a.sourceProjectId),
    aiProducerRunId:a.runId,youtubeVideoRunId:a.runId,youtubeVideoOptionId:a.optionId,
  }
  delete settings.captionsOnly
  await prisma.$transaction(async(tx)=>{
    const project=await tx.clipProject.upsert({
      where:{id:ids.projectId},
      create:{
        id:ids.projectId,workspaceId:a.workspaceId,createdById:a.createdById,title:a.title,
        uploadId:source.uploadId,sourceUrl:source.sourceUrl,settings:settings as Prisma.InputJsonValue,
        rangeStartMs:source.rangeStartMs,rangeEndMs:source.rangeEndMs,status:source.status,
        stage:source.stage,progress:source.progress,transcriptKey:source.transcriptKey,
        transcriptWords:source.transcriptWords??undefined,proxyKey:source.proxyKey,
        thumbKey:source.thumbKey,folderId:source.folderId,
      },
      update:{},select:{id:true,workspaceId:true},
    })
    if(project.workspaceId!==a.workspaceId)throw Error('youtube_output_project_identity_conflict')
    const clip=await tx.clip.upsert({
      where:{id:ids.clipId},
      create:{
        id:ids.clipId,projectId:ids.projectId,workspaceId:a.workspaceId,title:a.title,
        reason:'ai_producer',startMs:a.clipStartMs,endMs:a.clipEndMs,edits:{},
        editsSaveVersion:0,aiMeta:toPrismaJson({
          aiProducerRunId:a.runId,youtubeVideoRunId:a.runId,youtubeVideoOptionId:a.optionId,
        }),score:0,scores:{},
      },
      update:{},select:{id:true,projectId:true,workspaceId:true},
    })
    if(clip.projectId!==ids.projectId||clip.workspaceId!==a.workspaceId)
      throw Error('youtube_output_clip_identity_conflict')
  })
  console.info('[youtube-video:output]',{
    action:'deterministic_output_claimed',runId:a.runId,projectId:ids.projectId,clipId:ids.clipId,
  })
  return ids
}

export async function enqueueYoutubeVideoRenderOnce(a:{
  workspaceId:string;projectId:string;clipId:string;runId:string;optionId:string;
  title:string;edits:ClipEditsV2
}){
  const prisma=getPrisma()
  const ids=youtubeOutputIdentity(a.workspaceId,a.runId,a.optionId)
  if(ids.projectId!==a.projectId||ids.clipId!==a.clipId)
    throw Error('youtube_output_render_identity_conflict')
  const {width,height}=exportPixelSize('16:9','720p')
  const composeSpec=composeSpecV1Enabled(a.workspaceId,a.projectId)
    ?resolveComposeSpec(a.edits,width,height):null
  const hash=renderVersionHash(
    clipRenderHashMaterial(editsVersionHash(a.edits),{composeSpec}),'16:9','720p',
  )
  const filename=exportFilename(a.title)
  const expiresAt=new Date(Date.now()+7*24*60*60*1000)
  const render=await prisma.$transaction(async(tx)=>{
    const row=await tx.clipRender.upsert({
      where:{id:ids.renderId},
      create:{
        id:ids.renderId,clipId:a.clipId,workspaceId:a.workspaceId,status:'QUEUED',
        resolution:'720p',format:'mp4',aspectRatio:'16:9',watermark:false,filename,
        editsVersionHash:hash,expiresAt,outputKey:null,
      },
      update:{},
    })
    if(row.clipId!==a.clipId||row.workspaceId!==a.workspaceId||row.editsVersionHash!==hash)
      throw Error('youtube_output_render_identity_conflict')
    if(row.status==='QUEUED'||row.status==='RENDERING'){
      const job=await tx.clipJob.upsert({
        where:{id:ids.jobId},
        create:{
          id:ids.jobId,projectId:a.projectId,clipId:a.clipId,type:'RENDER_CLIP',status:'QUEUED',
          payload:toPrismaJson({
            renderId:ids.renderId,editsVersionHash:hash,...(composeSpec?{composeSpec}:{}),
          }),
        },
        update:{},
      })
      if(job.projectId!==a.projectId||job.clipId!==a.clipId||job.type!=='RENDER_CLIP')
        throw Error('youtube_output_job_identity_conflict')
    }
    return row
  })
  console.info('[youtube-video:output]',{
    action:'deterministic_render_claimed',runId:a.runId,projectId:a.projectId,
    clipId:a.clipId,status:render.status,
  })
  return {render}
}
