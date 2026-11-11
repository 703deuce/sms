import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { usePrivateUserTemplate } from '@/lib/server/clips/user-templates'
const schema=z.object({
 revision:z.number().int().positive().optional(),
 fills:z.record(z.string(),z.string().min(1).max(120)),
 text:z.record(z.string(),z.string().max(200)).optional(),
 musicUploadId:z.string().min(1).max(120).optional(),
}).strict()
export async function POST(req:Request,{params}:{params:Promise<{templateId:string}>}){
 try{
  const [workspaceId,actorUserId]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
  const {templateId}=await params
  return NextResponse.json({data:await usePrivateUserTemplate(workspaceId,actorUserId,templateId,schema.parse(await req.json()))},{status:201})
 }catch(e){return jsonError(e,400)}
}
