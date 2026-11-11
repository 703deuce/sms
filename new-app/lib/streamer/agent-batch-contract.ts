export type StreamerAgentMode='clip_moment_v1'|'clip_story_v1'|'clip_unified_v1'
export type StreamerAgentBatchResult={
  projectId:string;clipId:string;startMin:number
}
export type StreamerAgentBatch={
  id:string;status:'running'|'done'|'canceled'
  mode:StreamerAgentMode;seconds:30|60|90;index:number;total:number
  sourceStartMs:number;sourceDurationMs:number
  preparedProjectId?:string;runId?:string
  completed:StreamerAgentBatchResult[];errors:string[];startedAt:string
}
export function streamerAgentSettings(raw:unknown):Record<string,unknown>{
  return raw&&typeof raw==='object'&&!Array.isArray(raw)?
    raw as Record<string,unknown>:{}
}
export function readStreamerAgentBatch(raw:unknown):StreamerAgentBatch|null{
  const v=streamerAgentSettings(raw).agentClipBatch
  if(!v||typeof v!=='object'||Array.isArray(v))return null
  const b=v as StreamerAgentBatch
  if(typeof b.id!=='string'||!['running','done','canceled'].includes(b.status)||
    !Number.isSafeInteger(b.index)||!Number.isSafeInteger(b.total)||
    b.index<0||b.total<1||b.index>b.total||
    !['clip_moment_v1','clip_story_v1','clip_unified_v1'].includes(b.mode)||
    ![30,60,90].includes(b.seconds)||!Array.isArray(b.completed)||
    !Array.isArray(b.errors))return null
  return b
}

/** Only explicitly published clip ids are eligible for batch bookkeeping.
 * Run outputs are still checked against workspace/project ownership in the DB. */
export function publishedBatchClipIds(run:{
  resultClipId?:string|null;producerNotes?:unknown
}):string[]{
  const notes=run.producerNotes&&typeof run.producerNotes==='object'&&
    !Array.isArray(run.producerNotes)
    ?run.producerNotes as Record<string,unknown>:{}
  const listed=Array.isArray(notes.publishedClipIds)?notes.publishedClipIds:[]
  return [...new Set([run.resultClipId,...listed].filter(
    (id):id is string=>typeof id==='string'&&id.length>0))]
}
