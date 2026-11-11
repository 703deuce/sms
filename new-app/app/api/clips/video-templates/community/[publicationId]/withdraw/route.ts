import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { withdrawCommunityPublication } from '@/lib/server/clips/user-template-community'
export async function POST(req:Request,{params}:{params:Promise<{publicationId:string}>}){
 try{const [workspaceId,actor]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
  const {publicationId}=await params
  return NextResponse.json({data:await withdrawCommunityPublication(workspaceId,actor,publicationId)})
 }catch(e){return jsonError(e,400)}
}
