import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

/** Unlike Producer edits, clip-mode outputs belong to the uploaded project. */
export async function createSourceClip(input:{
  workspaceId:string;sourceProjectId:string;runId:string;
  title:string;startMs:number;endMs:number;mode:string
}){
  const prisma=getPrisma(),id=createId('clip')
  await prisma.$transaction(async tx=>{
    const source=await tx.clipProject.findFirst({
      where:{id:input.sourceProjectId,workspaceId:input.workspaceId,deletedAt:null},
      select:{id:true},
    })
    if(!source)throw Error('clip_source_project_unavailable')
    await tx.clip.create({data:{
      id,workspaceId:input.workspaceId,projectId:source.id,
      title:input.title,reason:'ai_producer',
      startMs:input.startMs,endMs:input.endMs,
      edits:{},editsSaveVersion:0,score:0,scores:{},
      aiMeta:{aiProducerRunId:input.runId,mode:input.mode},
    }})
  })
  return {projectId:input.sourceProjectId,clipId:id}
}
export async function publishClipScore(input:{
  workspaceId:string;clipId:string;runId:string;
  score:number;finderScore:number;qaPass:boolean|null;issues:string[];
  durationSeconds:number;candidateIndex:number;mode:string
  whyThisClip?:string
  stitchSegments?:Array<{startMs:number;endMs:number}>
  contextBridges?:Array<{atMs:number;text:string;passageIndex:number}>
  topics?:string[]
  needsReview?:boolean
  type?:'story'|'continuous'
  overlaps?:Array<{clipId:string;fraction:number}>
}){
  await getPrisma().clip.updateMany({
    where:{id:input.clipId,workspaceId:input.workspaceId},
    data:{
      score:input.score,
      scores:{hook:input.score,flow:input.qaPass?90:60,value:input.finderScore,trend:input.score},
      aiMeta:{
        aiProducerRunId:input.runId,clipMode:input.mode,
        finderScore:input.finderScore,editorialQaPass:input.qaPass,
        editorialIssues:input.issues.slice(0,10),
        candidateIndex:input.candidateIndex,durationSeconds:input.durationSeconds,
        whyThisClip:input.whyThisClip??null,
        stitchSegments:input.stitchSegments??[],
        contextBridges:input.contextBridges??[],
        topics:input.topics??[],
        editableStitchSegments:true,
        needsReview:input.needsReview===true,
        needsReviewReasons:input.needsReview===true?input.issues.slice(0,10):[],
        type:input.type??(input.mode==='clip_moment_v1'?'continuous':'story'),
        overlaps:input.overlaps??[],
      },
    },
  })
}
export async function discardClip(workspaceId:string,clipId:string){
  await getPrisma().clip.updateMany({where:{id:clipId,workspaceId},data:{deletedAt:new Date()}})
}
