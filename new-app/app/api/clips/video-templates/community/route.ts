import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { searchCommunityTemplates } from '@/lib/server/clips/user-template-community'
const n=(v:string|null)=>v==null||v===''?undefined:Number(v)
export async function GET(req:Request){
 try{const q=new URL(req.url).searchParams
  return NextResponse.json({data:await searchCommunityTemplates({
    q:q.get('q')??undefined,category:q.get('category')??undefined,tag:q.get('tag')??undefined,
    aspect:q.get('aspect')??undefined,minClips:n(q.get('minClips')),maxClips:n(q.get('maxClips')),
    minDurationMs:n(q.get('minDurationMs')),maxDurationMs:n(q.get('maxDurationMs')),page:n(q.get('page')),
  })})
 }catch(e){return jsonError(e,400)}
}
