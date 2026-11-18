import 'server-only'
import {createHash} from 'node:crypto'
import {getPrisma} from '@/lib/server/db'
import {MotionStudioError} from '@/lib/server/motion-studio/errors'
import {requireBotJob} from '@/lib/server/motion-studio/agent-bridge'
import {normalizeEdits,type ClipEditsV2} from '@/lib/clips/edits'
import {toPrismaJson} from '@/lib/server/clips/prisma-json'
import {AGENT_EDITOR_TOOLS,agentEditorTool,applyAgentEditorOperation,type AgentEditorTool} from '@/lib/motion-studio/editor-agent-operations'

const db=()=>getPrisma()
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{}
const err=(message:string,code='CONFLICT',status=409):never=>{
  throw new MotionStudioError(code,message,status)
}
async function editorClip(workspaceId:string,projectId:string){
  const project=await db().motionStudioProject.findFirst({
    where:{id:projectId,workspaceId},select:{clipId:true,clipProjectId:true},
  })
  if(!project?.clipId||!project.clipProjectId)
    err('Project has no editable timeline','NOT_FOUND',404)
  return {clipId:project!.clipId!,clipProjectId:project!.clipProjectId!}
}
export async function listEditorAgentTools(id:string,request:Request){
  const job=await requireBotJob(id,request)
  if(['complete','failed','cancelled','dispatch_failed'].includes(job.status))
    err('Finished jobs may not modify editor tools')
  const {clipId,clipProjectId}=await editorClip(job.workspaceId,job.projectId)
  const clip=await db().clip.findFirst({
    where:{id:clipId,workspaceId:job.workspaceId,projectId:clipProjectId,deletedAt:null},
    select:{id:true,edits:true,editsSaveVersion:true,startMs:true,endMs:true},
  })
  if(!clip)err('Editable timeline not found','NOT_FOUND',404)
  const bounds={clipStartMs:clip!.startMs,clipEndMs:clip!.endMs}
  const edits=normalizeEdits(clip!.edits,bounds)
  return{tools:AGENT_EDITOR_TOOLS,editor:{
    clipId:clip!.id,projectId:job.projectId,editsSaveVersion:clip!.editsSaveVersion,
    bounds,edits,
  }}
}
export async function applyEditorAgentTool(id:string,request:Request,raw:unknown){
  const job=await requireBotJob(id,request)
  if(['complete','failed','cancelled','dispatch_failed'].includes(job.status))
    err('Finished jobs cannot edit the timeline')
  const input=obj(raw)
  if(!agentEditorTool(input.tool))err('Unrecognized editor operation','INVALID',400)
  if(input.tool==='inspect_timeline')return listEditorAgentTools(id,request)
  const expectedVersion=Number(input.expectedVersion)
  const key=typeof input.idempotencyKey==='string'?input.idempotencyKey.slice(0,120):''
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!key)
    err('Current edit version and idempotency key are required','INVALID',400)
  const {clipId,clipProjectId}=await editorClip(job.workspaceId,job.projectId)
  const receiptId='msmsg_tool_'+createHash('sha256').update(id+':'+key).digest('hex').slice(0,32)
  const result=await db().$transaction(async tx=>{
    const receipt=await tx.motionStudioAgentMessage.findFirst({
      where:{id:receiptId,projectId:job.projectId,jobId:id,role:'agent_tool'},
    })
    if(receipt)return {ok:true,replayed:true}
    const clip=await tx.clip.findFirst({
      where:{id:clipId,workspaceId:job.workspaceId,projectId:clipProjectId,deletedAt:null},
      select:{id:true,edits:true,editsSaveVersion:true,startMs:true,endMs:true},
    })
    if(!clip)err('Editable timeline no longer exists','NOT_FOUND',404)
    if(clip!.editsSaveVersion!==expectedVersion)
      err('Customer edited the timeline. Reload before applying Grokbot changes.')
    const bounds={clipStartMs:clip!.startMs,clipEndMs:clip!.endMs}
    const current=normalizeEdits(clip!.edits,bounds)
    let next:ClipEditsV2
    try{next=applyAgentEditorOperation({
      edits:current,bounds,tool:input.tool as AgentEditorTool,
      parameters:input.parameters,
    })}catch(error){
      err(error instanceof Error?error.message:'Invalid editor operation','INVALID',400)
    }
    const change=await tx.clip.updateMany({
      where:{id:clipId,workspaceId:job.workspaceId,projectId:clipProjectId,
        editsSaveVersion:expectedVersion,deletedAt:null},
      data:{edits:toPrismaJson(next!),editsSaveVersion:{increment:1}},
    })
    if(!change.count)err('Concurrent customer timeline edit; retry from the latest version')
    await tx.motionStudioAgentMessage.create({data:{
      id:receiptId,projectId:job.projectId,jobId:id,role:'agent_tool',
      text:JSON.stringify({tool:input.tool,version:expectedVersion+1}).slice(0,500),
    }})
    return {ok:true,replayed:false,editsSaveVersion:expectedVersion+1}
  })
  return result
}
