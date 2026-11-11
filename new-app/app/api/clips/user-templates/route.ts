import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { createPrivateUserTemplate, listPrivateUserTemplates } from '@/lib/server/clips/user-templates'

const saveSchema=z.object({
  clipId:z.string().min(1).max(120),title:z.string().min(1).max(120),description:z.string().max(1000).optional(),
  replaceableItemKeys:z.array(z.string().max(180)).max(120),
  editableTextIds:z.array(z.string().max(120)).max(60),
  decorativeAssetKeys:z.array(z.string().max(300)).max(200),
  musicPolicy:z.enum(['keep','replace','mute']),
  previewRange:z.object({startMs:z.number().nonnegative(),endMs:z.number().positive()}).optional(),
}).strict()

export async function GET(req:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const q=new URL(req.url).searchParams
    const state=q.get('state')??''
    if(state&&!['pending','published','rejected','never-submitted'].includes(state))
      return NextResponse.json({error:'Invalid template state filter'},{status:400})
    return NextResponse.json({data:await listPrivateUserTemplates(workspaceId,q.get('q')??'',Number(q.get('page')??1),state)})
  }catch(e){return jsonError(e,500)}
}
export async function POST(req:Request){
  try{
    const [workspaceId,actorUserId]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
    const input=saveSchema.parse(await req.json())
    return NextResponse.json({data:await createPrivateUserTemplate(workspaceId,actorUserId,input)},{status:201})
  }catch(e){return jsonError(e,400)}
}
