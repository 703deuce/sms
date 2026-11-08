import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { createAiProducerOutputProject } from '@/lib/server/ai-producer-agent/create-output-project'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { MultiStoryPlan,MultiStorySource } from '@/lib/ai-producer-agent/multi-source-story'
import { buildMultiStoryInsertEdits } from '@/lib/ai-producer-agent/multi-source-assembly'

/** The existing editor/exporter already supports E5b inserts with ORIGINAL
 * video/audio. Create a conventional output clip whose first selected passage
 * is the main upload, and append the remaining passages in editorial order.
 * No existing single-source builder changes are required. */
export async function createMultiSourceStoryOutput(args:{
  workspaceId:string;createdById:string;runId:string
  inputs:MultiStorySource[];plan:MultiStoryPlan
}):Promise<{projectId:string;clipId:string;durationMs:number}>{
  const {workspaceId,createdById,runId,inputs,plan}=args
  if(!plan.cuts.length)throw Error('multisource_no_approved_cuts')
  const prisma=getPrisma()
  const sourceIds=[...new Set(plan.cuts.map(c=>c.sourceProjectId))]
  const projects=await prisma.clipProject.findMany({
    where:{workspaceId,deletedAt:null,id:{in:sourceIds}},
    select:{id:true,uploadId:true,upload:{
      select:{id:true,mime:true,status:true,durationMs:true,filename:true,width:true,height:true},
    }},
  })
  const byProject=new Map(projects.map(p=>[p.id,p]))
  const uploads=plan.cuts.map(c=>{
    const p=byProject.get(c.sourceProjectId)
    if(!p?.uploadId || !p.upload || p.upload.status!=='COMPLETE' ||
      !p.upload.mime.startsWith('video/'))throw Error('multisource_upload_not_ready')
    if(p.upload.durationMs && c.endMs>p.upload.durationMs+1000)
      throw Error('multisource_cut_exceeds_upload')
    return p.upload
  })
  const first=plan.cuts[0]!
  // Every other passage, including later passages from the first recording,
  // uses the existing E5b source-audio insert renderer. This avoids forcing
  // non-chronological ranges into a single-source trim/cut model.
  const created=await createAiProducerOutputProject({
    workspaceId,createdById,runId,title:plan.outline.title,
    sourceProjectId:first.sourceProjectId,clipStartMs:first.startMs,clipEndMs:first.endMs,
  })
  const distinct=new Map<string,typeof uploads[number]>()
  for(const upload of uploads)distinct.set(upload.id,upload)
  // E5 media references must belong to the output project's library.
  // Include the original main upload too, because it may recur later in
  // the story as an insert; the loader checks clip_project_media joins.
  for(const upload of distinct.values()){
    await prisma.clipProjectMedia.upsert({
      where:{projectId_uploadId:{projectId:created.projectId,uploadId:upload.id}},
      create:{id:createId('pmed'),projectId:created.projectId,workspaceId,
        uploadId:upload.id,mediaType:'video',label:upload.filename,
        durationMs:upload.durationMs,width:upload.width,height:upload.height,
        hasAudio:true},
      update:{mediaType:'video',durationMs:upload.durationMs},
    })
    const input=inputs.find(s=>byProject.get(s.source.projectId!)?.uploadId===upload.id)
    if(input){
      await prisma.clipMediaTranscript.upsert({
        where:{projectId_ref_refId:{projectId:created.projectId,ref:'upload',refId:upload.id}},
        create:{id:createId('mtr'),projectId:created.projectId,workspaceId,
          ref:'upload',refId:upload.id,status:'done',
          words:toPrismaJson(input.words.map(w=>({w:w.w,s:w.s,e:w.e,p:w.p,spk:w.spk}))),
          durationMs:upload.durationMs},
        update:{status:'done',
          words:toPrismaJson(input.words.map(w=>({w:w.w,s:w.s,e:w.e,p:w.p,spk:w.spk})))},
      })
    }
  }
  const bounds={clipStartMs:first.startMs,clipEndMs:first.endMs,
    trimMinMs:0,trimMaxMs:first.endMs}
  const edits:ClipEditsV2=buildMultiStoryInsertEdits(
    defaultEdits(bounds),plan,uploads.map(u=>({id:u.id,durationMs:u.durationMs,
      label:u.filename})),
  )
  await writeClipEditsOrThrow(created.clipId,bounds,0,()=>edits)
  await prisma.clip.update({
    where:{id:created.clipId},
    data:{aiMeta:toPrismaJson({
      aiProducerRunId:runId,
      ...(plan.mode==='clean_take_v1'?{cleanTake:{
        mode:plan.mode,outline:plan.outline,cuts:plan.cuts,
        durationMs:plan.estimatedDurationMs,
      }}:{multiSourceStory:{
        mode:plan.mode,outline:plan.outline,cuts:plan.cuts,
        durationMs:plan.estimatedDurationMs,
      }}),
    })},
  })
  return {...created,durationMs:plan.estimatedDurationMs}
}
