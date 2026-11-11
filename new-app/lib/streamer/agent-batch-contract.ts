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

/** Display only durable status facts. A queued tick is not an ETA guarantee. */
export function streamerBatchStatusText(batch:{
  status:string;index:number;total:number;startedAt?:string|null
},nowMs:number):string{
  const elapsed=typeof batch.startedAt==='string'?Date.parse(batch.startedAt):NaN
  const seconds=Number.isFinite(elapsed)&&Number.isFinite(nowMs)
    ?Math.max(0,Math.floor((nowMs-elapsed)/1000)):null
  const time=seconds===null?'elapsed unknown':
    `elapsed ${Math.floor(seconds/60)}m ${String(seconds%60).padStart(2,'0')}s`
  const progress=`window ${Math.min(batch.total,Math.max(0,batch.index)+1)}/${batch.total}`
  if(batch.status==='running')return `Batch queued/processing · ${progress} · ${time} · ETA unknown`
  if(batch.status==='done')return `Batch complete · ${time}`
  if(batch.status==='canceled')return `Batch canceled · ${time}`
  return `Batch status unavailable · ${time}`
}
