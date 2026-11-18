import 'server-only'
import {createHmac,timingSafeEqual,createHash} from 'node:crypto'
import {getPrisma} from '@/lib/server/db'
import {getClipStorage} from '@/lib/storage'
import {MotionStudioError} from '@/lib/server/motion-studio/errors'
import {validatePortableManifest} from '@/lib/motion-studio/portable-contract'
import {portableAssetSession} from '@/lib/server/motion-studio/portable-assets'

const db=()=>getPrisma()
const fail=(m:string,status=403):never=>{throw new MotionStudioError('UNAUTHENTICATED',m,status)}
const secret=()=>{
  const value=process.env.MOTION_STUDIO_SCENE_HOST_KEY||''
  if(value.length<32)fail('Scene preview host is not configured',503)
  return value
}
const safeId=(id:string)=>/^[A-Za-z0-9_.:-]{1,128}$/.test(id)
const sign=(parts:string[])=>createHmac('sha256',secret()).update(parts.join('|')).digest('hex')
const safePath=(v:string)=>{
  if(!v||v.length>512||v.startsWith('/')||v.includes('\\')||v.includes('\0')||
     v.split('/').some(part=>!part||part==='.'||part==='..'||! /^[A-Za-z0-9_.@+\-\[\]]+$/.test(part)))
    fail('Invalid scene source path')
  return v
}
const asObj=(v:unknown):Record<string,unknown>=>
  v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
function same(a:string,b:string){
  if(!/^[a-f0-9]{64}$/.test(a)||! /^[a-f0-9]{64}$/.test(b))return false
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'))
}
export function issueSceneSessionUrl(args:{
  requestUrl:string;projectId:string;versionId:string;bundleAssetId:string
}){
  const {projectId,versionId,bundleAssetId}=args
  if(![projectId,versionId,bundleAssetId].every(safeId))fail('Invalid scene host request')
  const expires=Math.floor(Date.now()/1000)+15*60
  const signature=sign([projectId,versionId,bundleAssetId,String(expires)])
  const url=new URL(args.requestUrl)
  // Public preview sessions are path-signed, not query-signed: scene-relative
  // script and font imports inherit the capability without client rewriting.
  const path=['api','motion-studio','_scene',projectId,versionId,
    bundleAssetId,String(expires),signature,'index.html'].map(encodeURIComponent).join('/')
  return {sceneUrl:url.origin+'/'+path,expiresAt:new Date(expires*1000).toISOString()}
}
export async function createSceneSession(workspaceId:string,projectId:string,versionId:string,sceneId:string,requestUrl:string){
  const version=await db().motionStudioPortableVersion.findFirst({
    where:{id:versionId,projectId,workspaceId,status:'committed'},
  })
  if(!version)fail('Original scene version not found',404)
  const manifest=validatePortableManifest(version!.manifest)
  const scene=manifest.scenes.find(s=>s.id===sceneId)
  if(!scene)fail('Scene not found',404)
  const refs=await portableAssetSession(workspaceId,projectId,versionId)
  const essential=[scene.bundleAssetId,...(scene.dependencies||[])]
  if(essential.some(id=>refs.unavailableAssetIds.includes(id)))
    fail('This scene is missing its original source dependencies',409)
  const native=asObj(manifest.producerDocument)
  const aliases=manifest.producerAssetMap||{}
  const urls:Record<string,string>={...refs.assetUrls}
  const records:Record<string,unknown>={}
  for(const [nativeId,storageId] of Object.entries(aliases)){
    if(urls[storageId])urls[nativeId]=urls[storageId]
    const asset=manifest.assets.find(a=>a.id===storageId)
    if(asset)records[nativeId]={kind:asset.kind,sha256:asset.sha256}
  }
  const fonts:Record<string,unknown>={}
  if(Array.isArray(native.fontRecords))for(const raw of native.fontRecords){
    const record=asObj(raw)
    const explicit=typeof record.fontId==='string'?record.fontId:
      typeof record.sha256==='string'?'fnt_'+record.sha256.slice(0,32):''
    if(safeId(explicit))fonts[explicit]=record
  }
  return {...issueSceneSessionUrl({requestUrl,projectId,versionId,
    bundleAssetId:scene.bundleAssetId}),assetUrls:urls,assetRecords:records,
    fonts,livePreview:scene.manifest.livePreview??null}
}
async function findAssetBytes(workspaceId:string,projectId:string,assetId:string){
  const asset=await db().studioAsset.findFirst({
    where:{id:assetId,projectId,workspaceId,status:'ready'},
    select:{uploadId:true},
  })
  if(!asset)fail('Source asset unavailable',404)
  const upload=await db().clipUpload.findFirst({
    where:{id:asset.uploadId,workspaceId},
    select:{key:true,bytes:true,status:true},
  })
  let key:string|null=null
  if(upload&&['READY','COMPLETE'].includes(upload.status)){
    if(upload.bytes>BigInt(25*1024*1024))fail('Source file too large for live scene hosting',413)
    key=upload.key
  }else{
    // Existing AI source assets were registered in StudioAsset without a
    // ClipUpload row. They remain durable in the job artifact manifest.
    const jobs=await db().motionStudioAgentJob.findMany({
      where:{workspaceId,projectId},select:{artifacts:true},
    })
    for(const job of jobs){
      if(!Array.isArray(job.artifacts))continue
      const matched=job.artifacts.find(value=>{
        const x=asObj(value)
        return x.id===assetId&&x.state==='ready'&&typeof x.key==='string'&&
          typeof x.bytes==='number'&&x.bytes<=25*1024*1024
      })
      if(matched){key=String(asObj(matched).key);break}
    }
  }
  if(!key)fail('Source asset has no verified storage location',404)
  return getClipStorage().getObjectBytes(key)
}
const contentType=(file:string)=>{
  const ext=file.split('.').pop()?.toLowerCase()
  const mime:Record<string,string>={
    html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',
    mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',
    json:'application/json',svg:'image/svg+xml',png:'image/png',
    jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',wasm:'application/wasm',
    ttf:'font/ttf',otf:'font/otf',woff:'font/woff',woff2:'font/woff2',
  }
  return mime[ext||'']||'application/octet-stream'
}
export async function sceneFileResponse(args:{
  projectId:string;versionId:string;bundleAssetId:string;expires:string;signature:string;
  filePath:string;requestUrl:string
}):Promise<Response>{
  const {projectId,versionId,bundleAssetId,expires,signature}=args
  if(![projectId,versionId,bundleAssetId].every(safeId)||
     !/^\d{10}$/.test(expires))fail('Invalid scene session')
  const expiry=Number(expires)
  if(expiry<Math.floor(Date.now()/1000)||expiry>Math.floor(Date.now()/1000)+3600)
    fail('Scene preview session expired')
  if(!same(signature,sign([projectId,versionId,bundleAssetId,expires])))
    fail('Invalid scene preview signature')
  const file=safePath(args.filePath)
  const version=await db().motionStudioPortableVersion.findFirst({
    where:{id:versionId,projectId,status:'committed'},
  })
  if(!version)fail('Scene version unavailable',404)
  const workspaceId=version.workspaceId
  const manifest=validatePortableManifest(version.manifest)
  const scene=manifest.scenes.find(s=>s.bundleAssetId===bundleAssetId)
  if(!scene)fail('Bundle is not part of this immutable version')
  // The content-addressed bundle is a JSON file listing each permitted
  // relative path and its exact asset digest, not a directory on the server.
  const raw=await findAssetBytes(workspaceId,projectId,bundleAssetId)
  let bundle:Record<string,unknown>
  try{bundle=asObj(JSON.parse(raw.toString('utf8')))}catch{fail('Invalid scene bundle',422)}
  const files=asObj(bundle.files),info=asObj(files[file])
  const nativeId=typeof info.asset==='string'?info.asset:''
  const claimedSha=typeof info.sha256==='string'?info.sha256.toLowerCase():''
  const aliases=manifest.producerAssetMap||{}
  const storedId=aliases[nativeId]||nativeId
  if(!safeId(nativeId)||!safeId(storedId)||
     !manifest.assets.some(a=>a.id===storedId&&a.sha256.toLowerCase()===claimedSha))
    fail('Scene file not registered in its project',404)
  const bytes=await findAssetBytes(workspaceId,projectId,storedId)
  if(!same(createHash('sha256').update(bytes).digest('hex'),claimedSha))
    fail('Scene source integrity mismatch',422)
  // The iframe has an opaque origin. It cannot access the parent DOM, cookies
  // or storage. Tight CSP restricts all network connections to known origins.
  const appOrigin=new URL(args.requestUrl).origin
  const allowedStorage=(process.env.MOTION_STUDIO_SCENE_ASSET_ORIGINS||'')
    .split(',').map(x=>x.trim()).filter(x=>{
      try{return new URL(x).protocol==='https:' && new URL(x).origin===x}catch{return false}
    }).join(' ')
  const csp=[
    `default-src 'none'`,
    `script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' ${appOrigin}`,
    `style-src 'unsafe-inline' ${appOrigin}`,
    `connect-src ${appOrigin} ${allowedStorage}`,
    `img-src data: blob: ${appOrigin} ${allowedStorage}`,
    `font-src data: ${appOrigin} ${allowedStorage}`,
    `media-src blob: ${appOrigin} ${allowedStorage}`,
    `frame-ancestors ${appOrigin}`,
    `form-action 'none'`,`base-uri 'none'`,`object-src 'none'`,
  ].join('; ')
  return new Response(new Uint8Array(bytes),{status:200,headers:{
    'Content-Type':contentType(file),'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'*',
    'Cross-Origin-Resource-Policy':'cross-origin',
    'Referrer-Policy':'no-referrer',
    'Cache-Control':'private, max-age=300',
    'Content-Security-Policy':csp,
  }})
}
