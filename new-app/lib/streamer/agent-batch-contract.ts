export type StreamerAgentMode='clip_moment_v1'|'clip_story_v1'
import type {AgentClipCandidate} from '@/lib/streamer/agent-clip-ranking'
export type StreamerAgentBatchResult={
  projectId:string;clipId:string;startMin:number
  score?:number;rank?:number;candidateId?:string;reason?:string;category?:string
  qaPass?:boolean;sourceCutsMs?:Array<[number,number]>
}
export type StreamerAgentBatch={
  id:string;status:'running'|'done'|'canceled'
  mode:StreamerAgentMode;seconds:30|60|90;index:number;total:number
  sourceStartMs:number;sourceDurationMs:number
  allWindows?:boolean;selectedStartMin?:number
  preparedProjectId?:string;runId?:string
  discoveryJobId?:string;candidates?:AgentClipCandidate[];candidateIndex?:number
  /** How many candidate clips were discovered for each source window. */
  discoveredCount?:number
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
    !['clip_moment_v1','clip_story_v1'].includes(b.mode)||
    ![30,60,90].includes(b.seconds)||!Array.isArray(b.completed)||
    !Array.isArray(b.errors))return null
  return b
}
