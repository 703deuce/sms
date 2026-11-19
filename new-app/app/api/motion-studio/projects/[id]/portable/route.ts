import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getPortableProject, commitPortableEdit, restorePortableVersion } from '@/lib/server/motion-studio/portable-projects'
import { pollingRoute } from '@/lib/server/db-read-gate'
import {validatePortableManifest} from '@/lib/motion-studio/portable-contract'
import {normalizeUniversalTimeline} from '@/lib/motion-studio/universal-timeline'
import {portableAssetSession} from '@/lib/server/motion-studio/portable-assets'
import {createSceneSession} from '@/lib/server/motion-studio/scene-host'
type Ctx={params:Promise<{id:string}>}
export const GET = pollingRoute(async function GET(request:Request,ctx:Ctx) {
  try {
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const query=new URL(request.url).searchParams
    const versionId=query.get('versionId')||undefined
    const result=await getPortableProject(workspaceId,projectId,versionId)
    // Opt-in editor bootstrap: the project and its short-lived scene sessions
    // share one authorization, project lookup and HTTP response. Other users
    // of this endpoint retain the existing response.
    if(query.get('bootstrap')!=='1'||!result.version)
      return NextResponse.json(result)
    const started=Date.now()
    try{
      const version=result.version
      const manifest=validatePortableManifest(version.manifest)
      const sceneIds=[...new Set(normalizeUniversalTimeline(manifest).visuals
        .filter(v=>v.type==='scene').map(v=>v.sceneId).filter((id):id is string=>Boolean(id)))].slice(0,3)
      if(!sceneIds.length)return NextResponse.json({...result,playback:null})
      const assets=await portableAssetSession(workspaceId,projectId,version.id,manifest)
      const sessions=await Promise.all(sceneIds.map(async sceneId=>({
        sceneId,...await createSceneSession(workspaceId,projectId,version.id,sceneId,request.url,assets,manifest)
      })))
      const directMediaKinds=new Set(['audio','video','image','font','caption','subtitle'])
      const mediaUrls=Object.fromEntries(manifest.assets
        .filter(asset=>directMediaKinds.has(asset.kind)&&assets.assetUrls[asset.id])
        .map(asset=>[asset.id,assets.assetUrls[asset.id]]))
      console.info('[motion-studio:load]',{kind:'project-bootstrap',projectId,
        stage:'complete',elapsedMs:Date.now()-started,sceneCount:sessions.length})
      return NextResponse.json({...result,playback:{versionId:version.id,sessions,mediaUrls}},{
        headers:{'Cache-Control':'private, no-store'}})
    }catch(error){
      // Loading the editor must remain possible if optional playback
      // preparation fails; the existing scene-session POST is the fallback.
      console.warn('[motion-studio:load]',{kind:'project-bootstrap',projectId,
        stage:'fallback',elapsedMs:Date.now()-started,
        error:error instanceof Error?error.message:'unknown'})
      return NextResponse.json({...result,playback:null})
    }
  } catch(e) { return motionStudioJsonError(e) }
})
export async function PATCH(request:Request,ctx:Ctx) {
  const started=Date.now()
  let outcome='failed'
  try {
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const body=await request.json()
    const result=await commitPortableEdit(workspaceId,projectId,body)
    outcome='committed'
    return NextResponse.json(result)
  } catch(e) {
    outcome=e instanceof Error ? e.name : 'unknown_error'
    return motionStudioJsonError(e)
  } finally {
    // Timing only; never log the customer's scene content or signed URLs.
    console.info('[motion-studio:portable-save]',{outcome,elapsedMs:Date.now()-started})
  }
}

export async function POST(request:Request,ctx:Ctx){
  try{
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    return NextResponse.json(await restorePortableVersion(workspaceId,projectId,await request.json()))
  }catch(error){return motionStudioJsonError(error)}
}
