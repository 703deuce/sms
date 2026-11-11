import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'
import { inspectClipForUserTemplate } from '@/lib/server/clips/user-templates'
export async function GET(req:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const clipId=(new URL(req.url).searchParams.get('clipId')??'').trim()
    if(!/^[A-Za-z0-9_-]{1,120}$/.test(clipId)) return NextResponse.json({error:'Invalid clip'},{status:400})
    return NextResponse.json({data:await inspectClipForUserTemplate(workspaceId,clipId)})
  }catch(e){return jsonError(e,400)}
}
