import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createReadableSignedUrl } from '@/lib/storage'
import { validatePortableManifest } from '@/lib/motion-studio/portable-contract'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { runWithConcurrency } from '@/lib/utils/run-with-concurrency'
const db=()=>getPrisma()
const SIGN_CONCURRENCY=6
/** Mint short-lived URLs from registered project assets; never persist URLs or raw storage keys. */
export async function portableAssetSession(workspaceId:string,projectId:string,versionId:string,
  knownManifest?:ReturnType<typeof validatePortableManifest>){
  const manifest=knownManifest??await (async()=>{
    const version=await db().motionStudioPortableVersion.findFirst({
      where:{id:versionId,workspaceId,projectId,status:'committed'},
    })
    if(!version)throw new MotionStudioError('NOT_FOUND','Project version not found.',404)
    return validatePortableManifest(version.manifest)
  })()
  const registered=await db().studioAsset.findMany({
    where:{workspaceId,projectId,id:{in:manifest.assets.map(a=>a.id)},status:'ready'},
    select:{id:true,uploadId:true},
  })
  const registeredIds=new Set(registered.map(a=>a.id))
  const artifactJobs=await db().motionStudioAgentJob.findMany({
    where:{workspaceId,projectId},select:{artifacts:true},
  })
  const keys=new Map<string,string>()
  const metadata:Record<string,{bytes:number;mime:string}> = {}
  for(const job of artifactJobs)for(const item of Array.isArray(job.artifacts)?job.artifacts:[]){
    if(!item||typeof item!=='object'||Array.isArray(item))continue
    const a=item as Record<string,unknown>
    if(typeof a.id==='string'&&typeof a.key==='string'&&a.state==='ready'&&registeredIds.has(a.id)){
      keys.set(a.id,a.key)
      if(typeof a.bytes==='number' && typeof a.mime==='string') metadata[a.id]={bytes:a.bytes,mime:a.mime}
    }
  }
  // Customer-uploaded assets have native clipUpload IDs rather than bot artifact IDs.
  const uploads=await db().clipUpload.findMany({
    where:{workspaceId,id:{in:registered.map(a=>a.uploadId)}},
    select:{id:true,key:true,status:true,bytes:true,mime:true},
  })
  for(const a of registered){
    if(keys.has(a.id))continue
    const upload=uploads.find(u=>u.id===a.uploadId)
    if(upload && (upload.status==='READY'||upload.status==='COMPLETE')){
      keys.set(a.id,upload.key)
      metadata[a.id]={bytes:Number(upload.bytes),mime:upload.mime}
    }
  }
  // Signing was sequential (one storage round trip per asset: ~17s for a
  // 29-asset live project). Bounded parallelism keeps it to a few seconds
  // without flooding the storage API. No DB connection is held meanwhile.
  const urls:Record<string,string>={}
  // Only host-played media needs raw signed storage URLs. Scene HTML,
  // scripts, frame packs and bundles use the separate signed scene proxy.
  // Avoid dozens of unnecessary storage signing operations at startup.
  const directMediaKinds=new Set(['audio','video','image','font','caption','subtitle'])
  const signable=manifest.assets.flatMap(asset=>{
    const key=keys.get(asset.id)
    return key&&directMediaKinds.has(asset.kind)?[{id:asset.id,key}]:[]
  })
  const signed=await runWithConcurrency(signable,SIGN_CONCURRENCY,async item=>
    [item.id,await createReadableSignedUrl(item.key,900).catch(()=>null)] as const)
  for(const [id,url] of signed)if(url)urls[id]=url
  return {versionId,expiresInSeconds:900,assetUrls:urls,metadata,
    availableAssetIds:manifest.assets.map(a=>a.id).filter(id=>keys.has(id)),
    unavailableAssetIds:manifest.assets.filter(asset=>!keys.has(asset.id)||(
      directMediaKinds.has(asset.kind)&&!urls[asset.id])).map(asset=>asset.id)}
}
