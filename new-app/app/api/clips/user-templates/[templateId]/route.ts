import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'
import { getPrivateUserTemplate, renamePrivateUserTemplate, softDeletePrivateUserTemplate } from '@/lib/server/clips/user-templates'
const patch=z.object({title:z.string().min(1).max(120).optional(),description:z.string().max(1000).optional()}).strict()
export async function GET(_req:Request,{params}:{params:Promise<{templateId:string}>}){
  try{const workspaceId=await resolveWorkspaceId();const {templateId}=await params
    return NextResponse.json({data:await getPrivateUserTemplate(workspaceId,templateId)})
  }catch(e){return jsonError(e,404)}
}
export async function PATCH(req:Request,{params}:{params:Promise<{templateId:string}>}){
  try{const workspaceId=await resolveWorkspaceId();const {templateId}=await params
    return NextResponse.json({data:await renamePrivateUserTemplate(workspaceId,templateId,patch.parse(await req.json()))})
  }catch(e){return jsonError(e,400)}
}
export async function DELETE(_req:Request,{params}:{params:Promise<{templateId:string}>}){
  try{const workspaceId=await resolveWorkspaceId();const {templateId}=await params
    await softDeletePrivateUserTemplate(workspaceId,templateId);return NextResponse.json({data:{deleted:true}})
  }catch(e){return jsonError(e,404)}
}
