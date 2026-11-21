import 'server-only'
import {getPrisma} from '@/lib/server/db'
import {requireBotJob} from '@/lib/server/motion-studio/agent-bridge'
import {MotionStudioError} from '@/lib/server/motion-studio/errors'
import {toPrismaJson} from '@/lib/server/clips/prisma-json'

const db=()=>getPrisma()
const safe=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[?&](?:X-Amz|token|Signature|access_token)[^\s]*/gi,'[redacted]').slice(0,max):''
const stages=['queued','rendering','qa_pass','qa_fail','retrying','needs_fix','attention_required','master_ready','uploaded','completed'] as const
type Stage=typeof stages[number]
const asRecord=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)
  ?x as Record<string,unknown>:{}
const errorResponse=(message:string)=>new MotionStudioError('INVALID',message,400)

/** Durable, job-scoped Modal render status; no schema change or public link. */
export async function reportModalRenderStatus(id:string,request:Request,raw:unknown){
  const job=await requireBotJob(id,request)
  const input=asRecord(raw)
  const stage=safe(input.stage,32) as Stage
  if(!stages.includes(stage))throw errorResponse('Invalid render status')
  if(['complete','failed'].includes(job.status)&&stage!=='completed'&&stage!=='qa_fail')
    throw new MotionStudioError('CONFLICT','Job already finished',409)
  const completed=Number(input.completed)
  const total=Number(input.total)
  if((input.completed!==undefined||input.total!==undefined)&&
    (!Number.isSafeInteger(completed)||completed<0||!Number.isSafeInteger(total)||
     total<1||completed>total||total>1000000))throw errorResponse('Invalid segment counts')
  const reason=safe(input.reason,1000)
  if(['qa_fail','retrying','needs_fix','attention_required'].includes(stage)&&!reason)
    throw errorResponse('Technical render failure category required')
  const attempt=input.attempt===undefined?undefined:Number(input.attempt)
  if(attempt!==undefined&&(!Number.isSafeInteger(attempt)||attempt<0||attempt>3))
    throw errorResponse('Invalid render attempt count')
  const masterFilename=safe(input.masterFilename,120)
  const shareFilename=safe(input.shareFilename,120)
  const frameGrabFilename=safe(input.frameGrabFilename,120)
  const timestampSeconds=input.timestampSeconds===undefined?undefined:Number(input.timestampSeconds)
  if(timestampSeconds!==undefined&&(!Number.isFinite(timestampSeconds)||
    timestampSeconds<0||timestampSeconds>72000))throw errorResponse('Invalid diagnostic timestamp')
  const filename=(value:string)=>!value||/^[A-Za-z0-9_.-]{1,120}$/.test(value)
  if(!filename(masterFilename)||!filename(shareFilename)||!filename(frameGrabFilename))
    throw errorResponse('Invalid recovery artifact name')
  const message=stage==='qa_fail'?'Technical render verification requires repair':
    stage==='retrying'?'Finishing touches, retrying the final render':
    stage==='needs_fix'||stage==='attention_required'?'Final render needs team review':
    stage==='master_ready'?'Video ready to watch; editable version preparing':
    stage==='rendering'?'Video segments are rendering':
    stage==='completed'?'Render delivery completed':stage
  await db().studioActivityEvent.create({data:{
    projectId:job.projectId,stage:'render',kind:'modal_render',
    message,data:toPrismaJson({jobId:id,stage,
      ...(input.total===undefined?{}:{completed,total}),
      ...(reason?{reason}:{}),
      ...(attempt!==undefined?{attempt}:{}),
      ...(masterFilename?{masterFilename}:{}),
      ...(shareFilename?{shareFilename}:{}),
      ...(frameGrabFilename?{frameGrabFilename}:{}),
      ...(timestampSeconds!==undefined?{timestampSeconds}:{})}),
  }})
  if(stage==='attention_required'){
    console.error('[motion-studio:render] owner attention required',
      {jobId:id,reason,attempt,masterFilename,shareFilename})
  }
  return {jobId:id,stage,...(input.total===undefined?{}:{completed,total})}
}
export async function readModalRenderStatus(id:string,request:Request){
  const job=await requireBotJob(id,request)
  const event=await db().studioActivityEvent.findFirst({
    where:{projectId:job.projectId,kind:'modal_render',
      data:{path:['jobId'],equals:id}},
    orderBy:{id:'desc'},select:{data:true,createdAt:true},
  })
  const status=asRecord(event?.data)
  return {jobId:id,stage:status.stage??'queued',completed:status.completed??0,
    total:status.total??0,reason:status.reason??null,
    attempt:status.attempt??null,
    masterFilename:status.masterFilename??null,
    shareFilename:status.shareFilename??null,
    frameGrabFilename:status.frameGrabFilename??null,
    timestampSeconds:status.timestampSeconds??null,
    updatedAt:event?.createdAt?.toISOString()??null}
}
/** Share the existing clips Modal 95%-of-monthly-spend guard, fail closed. */
export async function requireModalBudget(id:string,request:Request,estimateUsdMicros=0){
  await requireBotJob(id,request)
  if(!Number.isSafeInteger(estimateUsdMicros)||estimateUsdMicros<0||
    estimateUsdMicros>100000000)throw errorResponse('Invalid render estimate')
  const budget=Number(process.env.MODAL_MONTHLY_BUDGET_USD||'30')
  if(!Number.isFinite(budget)||budget<=0)throw new MotionStudioError(
    'INTERNAL','Modal budget is invalid.',503)
  const thresholdUsdMicros=Math.floor(budget*0.95*1_000_000)
  const now=new Date()
  const monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1))
  const sum=await db().aiUsage.aggregate({
    where:{provider:'modal',createdAt:{gte:monthStart}},
    _sum:{costUsdMicros:true},
  })
  const usedUsdMicros=sum._sum.costUsdMicros??0
  return {allowed:usedUsdMicros+estimateUsdMicros<thresholdUsdMicros,
    usedUsdMicros,thresholdUsdMicros}
}
