import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { usePublishedCommunityTemplate } from '@/lib/server/clips/user-template-community'
const schema=z.object({fills:z.record(z.string(),z.string().min(1).max(120)),
 text:z.record(z.string(),z.string().max(200)).optional(),musicUploadId:z.string().min(1).max(120).optional()}).strict()
export async function POST(req:Request,{params}:{params:Promise<{publicationId:string}>}){
 try{const [workspaceId,actor]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
  const {publicationId}=await params
  return NextResponse.json({data:await usePublishedCommunityTemplate(workspaceId,actor,publicationId,schema.parse(await req.json()))},{status:201})
 }catch(e){return jsonError(e,400)}
}
