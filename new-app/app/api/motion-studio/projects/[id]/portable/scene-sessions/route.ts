import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {createSceneSession} from '@/lib/server/motion-studio/scene-host'
import {portableAssetSession} from '@/lib/server/motion-studio/portable-assets'
import {getPortableProject} from '@/lib/server/motion-studio/portable-projects'
import {validatePortableManifest} from '@/lib/motion-studio/portable-contract'

type Ctx={params:Promise<{id:string}>}
export async function POST(request:Request,ctx:Ctx){
  try{
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const raw:unknown=await request.json()
    const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{}
    const versionId=typeof input.versionId==='string'?input.versionId:''
    const sceneIds=input.sceneIds
    if(!versionId||!Array.isArray(sceneIds)||sceneIds.length<1||sceneIds.length>3||
      sceneIds.some(id=>typeof id!=='string'||id.length>128)||
      new Set(sceneIds).size!==sceneIds.length)
      return NextResponse.json({error:'Provide one to three distinct scene IDs and a version ID'},{status:400})
    const {version}=await getPortableProject(workspaceId,projectId,versionId)
    if(!version)return NextResponse.json({error:'Version unavailable'},{status:404})
    const manifest=validatePortableManifest(version.manifest)
    const known=new Set(manifest.scenes.map(s=>s.id))
    if(sceneIds.some(id=>!known.has(id)))
      return NextResponse.json({error:'Scene not in this project'},{status:400})
    // Signing every asset per scene is expensive on large producer projects.
    const assets=await portableAssetSession(workspaceId,projectId,versionId)
    const sessions=await Promise.all(sceneIds.map(async id=>({
      sceneId:id,...await createSceneSession(workspaceId,projectId,versionId,id,request.url,assets)
    })))
    // The authenticated HOST may stream large original media directly. Do not
    // forward these signed storage URLs to an executable scene iframe: its
    // init.assetUrls remain limited to the scene-scoped signed proxy paths.
    const mediaUrls=Object.fromEntries(manifest.assets
      .filter(asset=>['audio','video','image','font','caption','subtitle'].includes(asset.kind))
      .flatMap(asset=>assets.assetUrls[asset.id]?[[asset.id,assets.assetUrls[asset.id]]]:[]))
    return NextResponse.json({versionId,sessions,mediaUrls},{headers:{'Cache-Control':'private, no-store'}})
  }catch(error){return motionStudioJsonError(error)}
}
