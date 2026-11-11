import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { addUserTemplateRevision } from '@/lib/server/clips/user-templates'
const schema=z.object({
 clipId:z.string().min(1).max(120),title:z.string().min(1).max(120),description:z.string().max(1000).optional(),
 replaceableItemKeys:z.array(z.string().max(180)).max(120),
 editableTextIds:z.array(z.string().max(120)).max(60),
 decorativeAssetKeys:z.array(z.string().max(300)).max(200),
 musicPolicy:z.enum(['keep','replace','mute']),
 previewRange:z.object({startMs:z.number().nonnegative(),endMs:z.number().positive()}).optional(),
}).strict()
export async function POST(req:Request,{params}:{params:Promise<{templateId:string}>}){
 try{const [workspaceId,actorUserId]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
  const {templateId}=await params
  return NextResponse.json({data:await addUserTemplateRevision(workspaceId,actorUserId,templateId,schema.parse(await req.json()))},{status:201})
 }catch(e){return jsonError(e,400)}
}
