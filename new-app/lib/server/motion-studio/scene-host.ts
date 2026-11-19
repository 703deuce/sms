import 'server-only'
import {createHmac,timingSafeEqual,createHash,hkdfSync} from 'node:crypto'
import {getPrisma} from '@/lib/server/db'
import {getClipStorage} from '@/lib/storage'
import {MotionStudioError} from '@/lib/server/motion-studio/errors'
import {validatePortableManifest} from '@/lib/motion-studio/portable-contract'
import {portableAssetSession} from '@/lib/server/motion-studio/portable-assets'

const db=()=>getPrisma()
function fail(m:string,status=403): never {
  // A signed URL does not require a customer login. Do not mislabel
  // unsupported MIME, missing storage, or invalid paths as authentication.
  const code = status === 401 ? 'UNAUTHENTICATED'
    : status === 403 ? 'FORBIDDEN'
    : status === 404 ? 'NOT_FOUND'
    : status === 409 ? 'CONFLICT'
    : status === 503 ? 'BUSY' : 'INVALID'
  throw new MotionStudioError(code,m,status)
}
/**
 * Scene-session signing key. Prefer a dedicated MOTION_STUDIO_SCENE_HOST_KEY
 * (>= 32 chars). When it is not configured, derive an independent key from an
 * existing server-only secret with HKDF-SHA256 and a fixed purpose label, so
 * live (masterless) projects can still play. The derived key never reveals the
 * base secret, and the signed scene URLs it protects live only 15 minutes.
 */
let derivedSceneKey:string|null=null
let warnedDerived=false
const secret=()=>{
  const value=process.env.MOTION_STUDIO_SCENE_HOST_KEY||''
  if(value.length>=32)return value
  const base=process.env.INTEGRATION_SECRET_KEY||process.env.WORKER_SHARED_SECRET||''
  if(base.length<32)fail('Scene preview host is not configured',503)
  if(!derivedSceneKey){
    derivedSceneKey=Buffer.from(hkdfSync('sha256',base,'transovo-scene-host','motion-studio/scene-host/v1',32)).toString('hex')
  }
  if(!warnedDerived){
    warnedDerived=true
    console.warn('[motion-studio:scene-host] using derived signing key; set MOTION_STUDIO_SCENE_HOST_KEY to a dedicated value')
  }
  return derivedSceneKey
}
function sceneHostOrigin(requestUrl:string){
  const origin=process.env.MOTION_STUDIO_AGENT_PUBLIC_URL||new URL(requestUrl).origin
  const app=new URL(origin)
  const local=process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(app.hostname)
  if((app.protocol!=='https:'&&!local)||app.username||app.password||
     (app.port!==''&&!local))fail('Configure the main Transovo HTTPS app origin for scene playback',503)
  return app.origin
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
  const scene=sceneHostOrigin(args.requestUrl)
  // Public preview sessions are path-signed, not query-signed: scene-relative
  // script and font imports inherit the capability without client rewriting.
  const path=['api','motion-studio','_scene',projectId,versionId,
    bundleAssetId,String(expires),signature,'index.html'].map(encodeURIComponent).join('/')
  return {sceneUrl:scene+'/'+path,expiresAt:new Date(expires*1000).toISOString()}
}
export async function createSceneSession(workspaceId:string,projectId:string,versionId:string,sceneId:string,requestUrl:string,sharedAssets?:Awaited<ReturnType<typeof portableAssetSession>>){
  const version=await db().motionStudioPortableVersion.findFirst({
    where:{id:versionId,projectId,workspaceId,status:'committed'},
  })
  if(!version)fail('Original scene version not found',404)
  const manifest=validatePortableManifest(version!.manifest)
  const scene=manifest.scenes.find(s=>s.id===sceneId)
  if(!scene)fail('Scene not found',404)
  const refs=sharedAssets??await portableAssetSession(workspaceId,projectId,versionId)
  const essential=[scene.bundleAssetId,...(scene.dependencies||[])]
  if(essential.some(id=>refs.unavailableAssetIds.includes(id)))
    fail('This scene is missing its original source dependencies',409)
  const native=asObj(manifest.producerDocument)
  const aliases=manifest.producerAssetMap||{}
  const issued=issueSceneSessionUrl({requestUrl,projectId,versionId,bundleAssetId:scene.bundleAssetId})
  const signedPrefix=issued.sceneUrl.slice(0,issued.sceneUrl.lastIndexOf('/')+1)
  // Do not leak raw storage URLs to sandboxed executable scenes. Every asset
  // download stays under this scene's time-limited signed CSP prefix.
  const urls:Record<string,string>={}
  const records:Record<string,unknown>={}
  for(const asset of manifest.assets){
    if(refs.assetUrls[asset.id])urls[asset.id]=signedPrefix+'_asset/'+encodeURIComponent(asset.id)
  }
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
  return {...issued,assetUrls:urls,assetRecords:records,
    fonts,livePreview:scene.manifest.livePreview??null}
}
// Immutable producer assets are requested repeatedly by the same scene runtime.
// Share in-flight downloads and briefly cache small verified source objects so
// dozens of parallel frame/script requests do not hit Prisma and storage again.
const assetByteCache=new Map<string,{value:Promise<Buffer>;until:number;bytes:number}>()
const MAX_CACHED_ASSET=8*1024*1024
const MAX_CACHE_BYTES=32*1024*1024
const CACHE_TTL_MS=60_000
function cachedAssetBytes(workspaceId:string,projectId:string,assetId:string):Promise<Buffer>{
  const key=JSON.stringify([workspaceId,projectId,assetId])
  const now=Date.now()
  for(const [k,v] of assetByteCache)if(v.until<=now)assetByteCache.delete(k)
  const hit=assetByteCache.get(key)
  if(hit){console.info('[motion-studio:load]',{kind:'asset-cache',hit:true,projectId,assetId});return hit.value}
  console.info('[motion-studio:load]',{kind:'asset-cache',hit:false,projectId,assetId})
  const value=findAssetBytes(workspaceId,projectId,assetId)
  const entry={value,until:now+CACHE_TTL_MS,bytes:0}
  assetByteCache.set(key,entry)
  void value.then(bytes=>{
    if(assetByteCache.get(key)!==entry)return
    if(bytes.length>MAX_CACHED_ASSET){assetByteCache.delete(key);return}
    entry.bytes=bytes.length
    let total=[...assetByteCache.values()].reduce((n,e)=>n+e.bytes,0)
    while(total>MAX_CACHE_BYTES){
      const oldest=assetByteCache.keys().next().value
      if(!oldest)break
      const removed=assetByteCache.get(oldest)!
      assetByteCache.delete(oldest)
      total-=removed.bytes
    }
  }).catch(()=>{if(assetByteCache.get(key)===entry)assetByteCache.delete(key)})
  return value
}
async function findAssetBytes(workspaceId:string,projectId:string,assetId:string){
  const started=Date.now()
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
  const resolvedMs=Date.now()-started
  const bytes=await getClipStorage().getObjectBytes(key)
  console.info('[motion-studio:load]',{kind:'source-asset',projectId,assetId,resolveMs:resolvedMs,storageMs:Date.now()-started-resolvedMs,totalMs:Date.now()-started,bytes:bytes.length})
  return bytes
}
const contentType=(file:string)=>{
  const ext=file.split('.').pop()?.toLowerCase()
  const mime:Record<string,string>={
    html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',
    mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',
    json:'application/json',svg:'image/svg+xml',png:'image/png',
    jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',wasm:'application/wasm',
    ttf:'font/ttf',otf:'font/otf',woff:'font/woff',woff2:'font/woff2',
    wav:'audio/wav',mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4',
    webm:'video/webm',vtt:'text/vtt; charset=utf-8',srt:'application/x-subrip',
  }
  return mime[ext||'']||'application/octet-stream'
}
// Scene versions are immutable. Coalesce the repeated version/manifest reads
// made by index.html, scripts, fonts and frame packs in one browser load.
// Each request still validates its signed path before reaching this cache.
type SceneSourceContext={
  workspaceId:string
  manifest:ReturnType<typeof validatePortableManifest>
}
const sceneContextCache=new Map<string,{until:number;value:Promise<SceneSourceContext>}>()
async function sceneSourceContext(projectId:string,versionId:string):Promise<SceneSourceContext>{
  const now=Date.now()
  for(const [k,v] of sceneContextCache)if(v.until<now)sceneContextCache.delete(k)
  const key=projectId+':'+versionId
  const cached=sceneContextCache.get(key)
  if(cached){console.info('[motion-studio:load]',{kind:'manifest-cache',hit:true,projectId});return cached.value}
  console.info('[motion-studio:load]',{kind:'manifest-cache',hit:false,projectId})
  const value=db().motionStudioPortableVersion.findFirst({
    where:{id:versionId,projectId,status:'committed'},
  }).then(version=>{
    if(!version)fail('Scene version unavailable',404)
    return {workspaceId:version.workspaceId,manifest:validatePortableManifest(version.manifest)}
  })
  if(sceneContextCache.size>=64)sceneContextCache.delete(sceneContextCache.keys().next().value!)
  sceneContextCache.set(key,{until:now+60_000,value})
  void value.catch(()=>{if(sceneContextCache.get(key)?.value===value)sceneContextCache.delete(key)})
  return value
}
export async function sceneFileResponse(args:{
  projectId:string;versionId:string;bundleAssetId:string;expires:string;signature:string;
  filePath:string;requestUrl:string
}):Promise<Response>{
  const {projectId,versionId,bundleAssetId,expires,signature}=args
  const appOrigin=sceneHostOrigin(args.requestUrl)
  if(new URL(args.requestUrl).origin!==appOrigin)
    fail('Scene resource host does not match the Transovo application')
  if(![projectId,versionId,bundleAssetId].every(safeId)||
     !/^\d{10}$/.test(expires))fail('Invalid scene session')
  const expiry=Number(expires)
  if(expiry<Math.floor(Date.now()/1000)||expiry>Math.floor(Date.now()/1000)+3600)
    fail('Scene preview session expired')
  if(!same(signature,sign([projectId,versionId,bundleAssetId,expires])))
    fail('Invalid scene preview signature')
  const file=safePath(args.filePath)
  const {workspaceId,manifest}=await sceneSourceContext(projectId,versionId)
  const scene=manifest.scenes.find(s=>s.bundleAssetId===bundleAssetId)
  if(!scene)fail('Bundle is not part of this immutable version')
  // Named font/media resources use the SAME signed path as scene code.
  // Only assets already declared in the immutable project can be requested.
  if(file.startsWith('_asset/')){
    const parts=file.split('/')
    if(parts.length!==2)fail('Invalid signed scene asset path',404)
    const assetId=parts[1]!
    const registered=manifest.assets.find(a=>a.id===assetId)
    if(!registered)fail('Asset not declared in scene project',404)
    const bytes=await cachedAssetBytes(workspaceId,projectId,assetId)
    const upload=await db().studioAsset.findFirst({
      where:{id:assetId,workspaceId,projectId,status:'ready'},
      select:{uploadId:true,kind:true},
    })
    const media=upload?await db().clipUpload.findFirst({
      where:{id:upload.uploadId,workspaceId},select:{mime:true},
    }):null
    let mime=media?.mime||''
    if(!mime){
      const jobs=await db().motionStudioAgentJob.findMany({
        where:{workspaceId,projectId},select:{artifacts:true},take:20,
      })
      for(const job of jobs){
        if(!Array.isArray(job.artifacts))continue
        const found=job.artifacts.find(a=>asObj(a).id===assetId)
        if(found){mime=String(asObj(found).mime||'');break}
      }
    }
    // Producer uploads may include a charset or use text/plain for VTT/JSON.
    // Accept these only for declared caption/text assets; never permit arbitrary
    // HTML or JS uploads to run inside the signed scene.
    const declaredKind=registered.kind
    const baseMime=mime.split(';',1)[0]!.trim().toLowerCase()
    const standard=/^(?:audio\/(?:wav|mpeg|mp4|ogg|x-wav|aac|x-m4a)|video\/(?:mp4|webm)|image\/(?:jpeg|png|webp|svg\+xml|avif)|font\/(?:ttf|otf|woff|woff2)|text\/vtt|application\/(?:x-subrip|json|font-woff|octet-stream|wasm))$/
    const textAsset=['caption','subtitle'].includes(declaredKind) &&
      ['text/plain','application/json','text/vtt'].includes(baseMime)
    if(!standard.test(baseMime)&&!textAsset){
      console.warn('[motion-studio:scene-host] unsupported_asset_mime',{
        kind:declaredKind,mime:baseMime||'(empty)',assetId,projectId,
      })
      fail('Unsupported signed scene asset type: '+(baseMime||'(missing)'),415)
    }
    // Text-only caption uploads must never acquire an executable MIME.
    mime=baseMime==='text/plain'&&textAsset?'text/plain; charset=utf-8':baseMime
    return new Response(new Uint8Array(bytes),{status:200,headers:{
      'Content-Type':mime,'Content-Disposition':'inline',
      'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; frame-ancestors 'self'",
      'X-Content-Type-Options':'nosniff',
      'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin',
      'Cache-Control':'private, max-age=300','Referrer-Policy':'no-referrer',
    }})
  }
  // The content-addressed bundle is a JSON file listing each permitted
  // relative path and its exact asset digest, not a directory on the server.
  const raw=await cachedAssetBytes(workspaceId,projectId,bundleAssetId)
  let bundle:Record<string,unknown>
  try{bundle=asObj(JSON.parse(raw.toString('utf8')))}catch{fail('Invalid scene bundle',422)}
  const files=asObj(bundle.files),info=asObj(files[file])
  const nativeId=typeof info.asset==='string'?info.asset:''
  const claimedSha=typeof info.sha256==='string'?info.sha256.toLowerCase():''
  const aliases=manifest.producerAssetMap||{}
  const assetSha=info.packSha256 === undefined ? claimedSha : String(info.packSha256)
  const storedId=aliases[nativeId]||nativeId
  if(!safeId(nativeId)||!safeId(storedId)||
     !manifest.assets.some(a=>a.id===storedId&&a.sha256.toLowerCase()===assetSha))
    fail('Scene file not registered in its project',404)
  let bytes=await findAssetBytes(workspaceId,projectId,storedId)
  if (info.packSha256 !== undefined) {
    const offset=Number(info.offset), length=Number(info.bytes)
    if (!Number.isSafeInteger(offset) || offset<0 || !Number.isSafeInteger(length) ||
        length<1 || offset+length>bytes.length) fail('Invalid packed frame',422)
    bytes=bytes.subarray(offset,offset+length)
  }
  if(!same(createHash('sha256').update(bytes).digest('hex'),claimedSha))
    fail('Scene source integrity mismatch',422)
  // The iframe has an opaque origin. It cannot access the parent DOM, cookies
  // or storage. Tight CSP restricts all network connections to known origins.
  // CSP sandbox applies even to top-level navigation, giving executable
  // producer files an opaque origin. Never allow a generated frame the parent
  // app's origin, cookies, storage or arbitrary API requests.
  const prefix=appOrigin+'/api/motion-studio/_scene/'+
    [projectId,versionId,bundleAssetId,expires,signature].map(encodeURIComponent).join('/')+'/'
  const csp=[
    'sandbox allow-scripts',
    "default-src 'none'",
    `script-src ${prefix} 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'`,
    `style-src ${prefix} 'unsafe-inline'`,
    `connect-src ${prefix}`,
    `img-src ${prefix} data: blob:`,
    `font-src ${prefix} data:`,
    `media-src ${prefix} blob:`,
    `worker-src ${prefix} blob:`,
    `frame-ancestors 'self'`,
    "form-action 'none'","base-uri 'none'","object-src 'none'",
  ].join('; ')
  return new Response(new Uint8Array(bytes),{status:200,headers:{
    'Content-Type':contentType(file),'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'*',
    'Cross-Origin-Resource-Policy':'cross-origin',
    'Referrer-Policy':'no-referrer',
    'Cache-Control':'private, max-age=300',
    'Content-Disposition':'inline',
    'Content-Security-Policy':csp,
  }})
}
