import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { moderateCommunityTemplate, requireTemplateModerator } from '@/lib/server/clips/user-template-community'
const schema=z.object({action:z.enum(['approve','reject','hide','unpublish','restore']),reason:z.string().max(1000).optional()}).strict()
export async function POST(req:Request,{params}:{params:Promise<{publicationId:string}>}){
 try{const moderator=await requireTemplateModerator(req);const {publicationId}=await params
  return NextResponse.json({data:await moderateCommunityTemplate(moderator,publicationId,schema.parse(await req.json()))})
 }catch(e){return jsonError(e,403)}
}
