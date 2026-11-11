import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { jsonError } from '@/lib/server/api-error'
import { submitUserTemplateForReview } from '@/lib/server/clips/user-template-community'
const schema=z.object({
 revision:z.number().int().positive().optional(),title:z.string().min(1).max(120),description:z.string().max(1000).default(''),
 category:z.enum(['gaming','podcast','social','business','education','lifestyle','other']),
 tags:z.array(z.string().max(32)).max(8).default([]),creatorName:z.string().min(1).max(80),
 licenseTerms:z.string().min(1).max(600),ownsOrLicensed:z.literal(true),
 recognizablePeoplePermission:z.literal(true),authorReviewedExampleText:z.literal(true),
}).strict()
export async function POST(req:Request,{params}:{params:Promise<{templateId:string}>}){
 try{const [workspaceId,actor]=await Promise.all([resolveWorkspaceId(),resolveClipsActorUserId(req)])
  const {templateId}=await params
  return NextResponse.json({data:await submitUserTemplateForReview(workspaceId,actor,templateId,schema.parse(await req.json()))},{status:201})
 }catch(e){return jsonError(e,400)}
}
