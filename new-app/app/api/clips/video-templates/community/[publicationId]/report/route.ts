import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { reportCommunityTemplate } from '@/lib/server/clips/user-template-community'
const schema=z.object({reason:z.enum(['abuse','privacy','copyright','spam']),details:z.string().max(1200).optional()}).strict()
export async function POST(req:Request,{params}:{params:Promise<{publicationId:string}>}){
 try{const [workspaceId,actor]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
  const {publicationId}=await params
  return NextResponse.json({data:await reportCommunityTemplate(workspaceId,actor,publicationId,schema.parse(await req.json()))},{status:201})
 }catch(e){return jsonError(e,400)}
}
