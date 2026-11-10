import 'server-only'
import {getPrisma} from '@/lib/server/db'
import {UNIFIED_OVERLAP_THRESHOLD} from '@/lib/ai-producer-agent/clip-mode/unified-merge'

export type UnifiedClipResult={
  clipId:string
  projectId:string
  type:'story'|'continuous'
  title:string
  score:number
  durationSeconds:number
  startMs:number
  endMs:number
  segments:Array<{startMs:number;endMs:number}>
  needsReview:boolean
  needsReviewReasons:string[]
  whyThisClip:string|null
  overlaps:Array<{clipId:string;fraction:number}>
  autoExported:boolean
}

export type UnifiedClipResultsPayload={
  runId:string
  status:string
  mix:{story:number;continuous:number;droppedDuplicates:number}
  overlapThreshold:typeof UNIFIED_OVERLAP_THRESHOLD
  clips:UnifiedClipResult[]
}

type AiMeta={
  aiProducerRunId?:unknown
  type?:unknown
  clipMode?:unknown
  mode?:unknown
  durationSeconds?:unknown
  stitchSegments?:unknown
  needsReview?:unknown
  needsReviewReasons?:unknown
  whyThisClip?:unknown
  overlaps?:unknown
}

function asType(meta:AiMeta):'story'|'continuous'{
  if(meta.type==='continuous'||meta.type==='story')return meta.type
  const mode=meta.clipMode??meta.mode
  return mode==='clip_moment_v1'?'continuous':'story'
}

function asSegments(meta:AiMeta,startMs:number,endMs:number):Array<{startMs:number;endMs:number}>{
  if(Array.isArray(meta.stitchSegments)){
    const segs=meta.stitchSegments.flatMap((s)=>{
      if(!s||typeof s!=='object')return []
      const start=Number((s as {startMs?:unknown}).startMs)
      const end=Number((s as {endMs?:unknown}).endMs)
      return Number.isFinite(start)&&Number.isFinite(end)&&end>start?[{startMs:start,endMs:end}]:[]
    })
    if(segs.length)return segs
  }
  return [{startMs,endMs}]
}

function asOverlaps(meta:AiMeta):Array<{clipId:string;fraction:number}>{
  if(!Array.isArray(meta.overlaps))return []
  return meta.overlaps.flatMap((item)=>{
    if(!item||typeof item!=='object')return []
    const clipId=String((item as {clipId?:unknown}).clipId??'')
    const fraction=Number((item as {fraction?:unknown}).fraction)
    return clipId&&Number.isFinite(fraction)?[{clipId,fraction}]:[]
  })
}

function compareResults(a:UnifiedClipResult,b:UnifiedClipResult):number{
  if(b.score!==a.score)return b.score-a.score
  if(a.type!==b.type)return a.type==='story'?-1:1
  return a.startMs-b.startMs
}

export async function listUnifiedClipResults(
  workspaceId:string,runId:string,
):Promise<UnifiedClipResultsPayload|null>{
  const prisma=getPrisma()
  const run=await prisma.aiProducerAgentRun.findFirst({
    where:{id:runId,workspaceId},
    select:{id:true,status:true,producerNotes:true},
  })
  if(!run)return null
  const rows=await prisma.clip.findMany({
    where:{
      workspaceId,
      deletedAt:null,
      aiMeta:{path:['aiProducerRunId'],equals:runId},
    },
    select:{
      id:true,projectId:true,title:true,score:true,startMs:true,endMs:true,aiMeta:true,
      renders:{select:{id:true,status:true},take:5},
    },
  })
  const clips:UnifiedClipResult[]=rows.map((row)=>{
    const meta=(row.aiMeta&&typeof row.aiMeta==='object'&&!Array.isArray(row.aiMeta)
      ?row.aiMeta:{}) as AiMeta
    const segments=asSegments(meta,row.startMs,row.endMs)
    const durationSeconds=typeof meta.durationSeconds==='number'
      ?meta.durationSeconds
      :segments.reduce((n,s)=>n+(s.endMs-s.startMs),0)/1000
    const needsReview=meta.needsReview===true
    const reasons=Array.isArray(meta.needsReviewReasons)
      ?meta.needsReviewReasons.map((r)=>String(r)).filter(Boolean)
      :[]
    return {
      clipId:row.id,
      projectId:row.projectId,
      type:asType(meta),
      title:row.title,
      score:row.score,
      durationSeconds,
      startMs:row.startMs,
      endMs:row.endMs,
      segments,
      needsReview,
      needsReviewReasons:needsReview?reasons:[],
      whyThisClip:typeof meta.whyThisClip==='string'?meta.whyThisClip:null,
      overlaps:asOverlaps(meta),
      autoExported:!needsReview&&row.renders.some((r)=>r.status==='QUEUED'||r.status==='RENDERING'||r.status==='READY'),
    }
  }).sort(compareResults)

  const notes=run.producerNotes&&typeof run.producerNotes==='object'&&!Array.isArray(run.producerNotes)
    ?(run.producerNotes as {unifiedMix?:{droppedDuplicates?:unknown}}):null
  const dropped=Number(notes?.unifiedMix?.droppedDuplicates)
  const story=clips.filter((c)=>c.type==='story').length
  const continuous=clips.filter((c)=>c.type==='continuous').length
  return {
    runId:run.id,
    status:run.status,
    mix:{
      story,
      continuous,
      droppedDuplicates:Number.isFinite(dropped)?dropped:0,
    },
    overlapThreshold:UNIFIED_OVERLAP_THRESHOLD,
    clips,
  }
}
