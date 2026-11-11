import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPublishedCommunityTemplate } from '@/lib/server/clips/user-template-community'
export async function GET(_req:Request,{params}:{params:Promise<{publicationId:string}>}){
 try{const {publicationId}=await params
  return NextResponse.json({data:await getPublishedCommunityTemplate(publicationId)})
 }catch(e){return jsonError(e,404)}
}
