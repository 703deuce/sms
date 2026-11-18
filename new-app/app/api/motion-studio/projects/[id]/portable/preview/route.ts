import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {getPrisma} from '@/lib/server/db'
import {createReadableSignedUrl} from '@/lib/storage'
import {validatePortableManifest} from '@/lib/motion-studio/portable-contract'
import { pollingRoute } from '@/lib/server/db-read-gate'

type Ctx={params:Promise<{id:string}>}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}

/** Sign only the existing producer master, rather than requesting the expensive
 * editable-scene host or signing every one of the packed scene's assets.
 * This is a browser playback URL; it never schedules a render.
 */
export const GET = pollingRoute(async function GET(request:Request,ctx:Ctx){
  try{
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const db=getPrisma()
    const version=await db.motionStudioPortableVersion.findFirst({
      where:{workspaceId,projectId,status:'committed'},
      orderBy:{revision:'desc'},select:{manifest:true,id:true},
    })
    if(!version)return NextResponse.json({url:null,reason:'no_version'})
    const manifest=validatePortableManifest(version.manifest)
    const native=obj(manifest.producerDocument)
    const masterId=obj(native.master).asset
    if(typeof masterId!=='string')
      return NextResponse.json({url:null,reason:'no_master'})
    const assetId=manifest.producerAssetMap?.[masterId]||masterId
    if(!manifest.assets.some(asset=>asset.id===assetId&&asset.kind==='video'))
      return NextResponse.json({url:null,reason:'invalid_master'})
    const registered=await db.studioAsset.findFirst({
      where:{id:assetId,workspaceId,projectId,status:'ready'},
      select:{uploadId:true},
    })
    if(!registered)return NextResponse.json({url:null,reason:'master_unavailable'})
    let key:string|null=null
    const upload=await db.clipUpload.findFirst({
      where:{id:registered.uploadId,workspaceId},
      select:{key:true,status:true},
    })
    if(upload&&['READY','COMPLETE'].includes(upload.status))key=upload.key
    if(!key){
      const jobs=await db.motionStudioAgentJob.findMany({
        where:{workspaceId,projectId},select:{artifacts:true},take:15,
      })
      for(const job of jobs){
        if(!Array.isArray(job.artifacts))continue
        const entry=job.artifacts.find(item=>{
          const a=obj(item)
          return a.id===assetId&&a.state==='ready'&&typeof a.key==='string'
        })
        if(entry){key=String(obj(entry).key);break}
      }
    }
    if(!key)return NextResponse.json({url:null,reason:'master_unavailable'})
    const url=await createReadableSignedUrl(key,900)
    return NextResponse.json({url,expiresInSeconds:900},{
      headers:{'Cache-Control':'private, no-store'},
    })
  }catch(error){return motionStudioJsonError(error)}
})
