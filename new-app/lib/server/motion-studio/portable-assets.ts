import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createReadableSignedUrl } from '@/lib/storage'
import { validatePortableManifest } from '@/lib/motion-studio/portable-contract'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
const db=()=>getPrisma()
/** Mint short-lived URLs from registered project assets; never persist URLs or raw storage keys. */
export async function portableAssetSession(workspaceId:string,projectId:string,versionId:string){
  const version=await db().motionStudioPortableVersion.findFirst({
    where:{id:versionId,workspaceId,projectId,status:'committed'},
  })
  if(!version)throw new MotionStudioError('NOT_FOUND','Project version not found.',404)
  const manifest=validatePortableManifest(version.manifest)
  const registered=await db().studioAsset.findMany({
    where:{workspaceId,projectId,id:{in:manifest.assets.map(a=>a.id)},status:'ready'},
    select:{id:true,uploadId:true},
  })
  const registeredIds=new Set(registered.map(a=>a.id))
  const artifactJobs=await db().motionStudioAgentJob.findMany({
    where:{workspaceId,projectId},select:{artifacts:true},
  })
  const keys=new Map<string,string>()
  for(const job of artifactJobs)for(const item of Array.isArray(job.artifacts)?job.artifacts:[]){
    if(!item||typeof item!=='object'||Array.isArray(item))continue
    const a=item as Record<string,unknown>
    if(typeof a.id==='string'&&typeof a.key==='string'&&a.state==='ready'&&registeredIds.has(a.id))
      keys.set(a.id,a.key)
  }
  // Customer-uploaded assets have native clipUpload IDs rather than bot artifact IDs.
  const uploads=await db().clipUpload.findMany({
    where:{id:{in:registered.map(a=>a.uploadId)}},
    select:{id:true,key:true,status:true},
  })
  for(const a of registered){
    if(keys.has(a.id))continue
    const upload=uploads.find(u=>u.id===a.uploadId)
    if(upload && (upload.status==='READY'||upload.status==='COMPLETE'))keys.set(a.id,upload.key)
  }
  const urls:Record<string,string>={}
  for(const asset of manifest.assets){
    const key=keys.get(asset.id)
    if(!key)continue
    const url=await createReadableSignedUrl(key,900).catch(()=>null)
    if(url)urls[asset.id]=url
  }
  return {versionId,expiresInSeconds:900,assetUrls:urls,
    unavailableAssetIds:manifest.assets.map(a=>a.id).filter(id=>!urls[id])}
}
