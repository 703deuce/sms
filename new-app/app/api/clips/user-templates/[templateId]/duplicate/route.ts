import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { duplicatePrivateUserTemplate } from '@/lib/server/clips/user-templates'
export async function POST(req:Request,{params}:{params:Promise<{templateId:string}>}){
 try{const [workspaceId,actorUserId]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
  const {templateId}=await params
  return NextResponse.json({data:await duplicatePrivateUserTemplate(workspaceId,actorUserId,templateId)},{status:201})
 }catch(e){return jsonError(e,400)}
}
