import 'server-only'
import {createHmac,timingSafeEqual,hkdfSync} from 'node:crypto'
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
export async function createSceneSession(workspaceId:string,projectId:string,versionId:string,sceneId:string,requestUrl:string,sharedAssets?:Awaited<ReturnType<typeof portableAssetSession>>,sharedManifest?:ReturnType<typeof validatePortableManifest>){
  // The authenticated issuance route already read this immutable version.
  // Never re-query/revalidate it once per scene in the same request.
  const manifest=sharedManifest??await (async()=>{
    const version=await db().motionStudioPortableVersion.findFirst({
      where:{id:versionId,projectId,workspaceId,status:'committed'},
    })
    if(!version)fail('Original scene version not found',404)
    return validatePortableManifest(version.manifest)
  })()
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
    if(refs.availableAssetIds.includes(asset.id)&&!refs.unavailableAssetIds.includes(asset.id))urls[asset.id]=signedPrefix+'_asset/'+encodeURIComponent(asset.id)
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
// Keep a bounded cache of immutable scene bytes. The key includes the scene
// version, so a later edit never reuses an earlier source.
const assetByteCache=new Map<string,{value:Promise<Buffer>;until:number;bytes:number}>()
const MAX_CACHED_ASSET=8*1024*1024
const MAX_CACHE_BYTES=32*1024*1024
const CACHE_TTL_MS=60_000
function cachedAssetBytes(projectId:string,versionId:string,assetId:string):Promise<Buffer>{
  const key=JSON.stringify([projectId,versionId,assetId])
  const now=Date.now()
  for(const [k,v] of assetByteCache)if(v.until<=now)assetByteCache.delete(k)
  const hit=assetByteCache.get(key)
  if(hit){console.info('[motion-studio:load]',{kind:'asset-cache',hit:true,projectId,assetId});return hit.value}
  console.info('[motion-studio:load]',{kind:'asset-cache',hit:false,projectId,assetId})
  const value=readSceneAssetBytes(projectId,versionId,assetId)
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

async function readSceneAssetBytes(projectId:string,versionId:string,assetId:string):Promise<Buffer>{
  const started=Date.now()
  const {sources}=await sceneSourceContext(projectId,versionId)
  const source=sources.get(assetId)
  if(!source)fail('Source asset has no verified storage location',404)
  if(!Number.isFinite(source.bytes)||source.bytes>25*1024*1024)fail('Source file too large for live scene hosting',413)
  const resolvedMs=Date.now()-started
  const bytes=await getClipStorage().getObjectBytes(source.key)
  if(bytes.length>25*1024*1024)fail('Source file too large for live scene hosting',413)
  console.info('[motion-studio:load]',{kind:'source-asset',projectId,assetId,
    resolveMs:resolvedMs,storageMs:Date.now()-started-resolvedMs,totalMs:Date.now()-started,
    bytes:bytes.length})
  return bytes
}
/** Prewarm only the immutable first scene's index backing object. This
 * overlaps the session's DB/signing work with the otherwise serial B2 cold
 * read. Errors do not fail project loading; the normal signed route remains
 * authoritative and will retry on demand.
 */
export async function prewarmSceneIndex(projectId:string,versionId:string,bundleAssetId:string){
  const started=Date.now()
  try{
    const {manifest,sources}=await sceneSourceContext(projectId,versionId)
    if(!manifest.scenes.some(scene=>scene.bundleAssetId===bundleAssetId))return
    const raw=await cachedAssetBytes(projectId,versionId,bundleAssetId)
    const bundle=asObj(JSON.parse(raw.toString('utf8')))
    const info=asObj(asObj(bundle.files)['index.html'])
    const nativeId=typeof info.asset==='string'?info.asset:''
    const id=manifest.producerAssetMap?.[nativeId]||nativeId
    if(!safeId(id)||!sources.has(id))return
    await cachedAssetBytes(projectId,versionId,id)
    console.info('[motion-studio:load]',{kind:'scene-index-prewarm',
      projectId,status:'ready',elapsedMs:Date.now()-started})
  }catch(error){
    console.warn('[motion-studio:load]',{kind:'scene-index-prewarm',
      projectId,status:'miss',elapsedMs:Date.now()-started,
      error:error instanceof Error?error.message:'unknown'})
  }
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
type SceneAssetSource={key:string;mime:string;kind:string;bytes:number}
type SceneSourceContext={
  workspaceId:string
  manifest:ReturnType<typeof validatePortableManifest>
  sources:Map<string,SceneAssetSource>
}
const sceneContextCache=new Map<string,{until:number;value:Promise<SceneSourceContext>}>()
async function sceneSourceContext(projectId:string,versionId:string):Promise<SceneSourceContext>{
  const now=Date.now()
  for(const [k,v] of sceneContextCache)if(v.until<now)sceneContextCache.delete(k)
  const key=projectId+':'+versionId
  const cached=sceneContextCache.get(key)
  if(cached){console.info('[motion-studio:load]',{kind:'manifest-cache',hit:true,projectId});return cached.value}
  console.info('[motion-studio:load]',{kind:'manifest-cache',hit:false,projectId})
  const value=(async()=>{
    const started=Date.now()
    const version=await db().motionStudioPortableVersion.findFirst({
      where:{id:versionId,projectId,status:'committed'},
    })
    if(!version)fail('Scene version unavailable',404)
    const workspaceId=version.workspaceId
    const manifest=validatePortableManifest(version.manifest)
    // Resolve every source location once, not per signed HTML/script/font/frame.
    const [registered,jobs]=await Promise.all([
      db().studioAsset.findMany({
        where:{workspaceId,projectId,status:'ready',id:{in:manifest.assets.map(a=>a.id)}},
        select:{id:true,uploadId:true,kind:true},
      }),
      db().motionStudioAgentJob.findMany({
        where:{workspaceId,projectId},select:{artifacts:true},
      }),
    ])
    const uploads=await db().clipUpload.findMany({
      where:{workspaceId,id:{in:registered.map(a=>a.uploadId)}},
      select:{id:true,key:true,bytes:true,mime:true,status:true},
    })
    const byUpload=new Map(uploads.map(u=>[u.id,u]))
    const sources=new Map<string,SceneAssetSource>()
    for(const asset of registered){
      const upload=byUpload.get(asset.uploadId)
      if(upload&&['READY','COMPLETE'].includes(upload.status)){
        sources.set(asset.id,{key:upload.key,mime:upload.mime,kind:asset.kind,bytes:Number(upload.bytes)})
      }
    }
    const registeredKinds=new Map(registered.map(a=>[a.id,a.kind]))
    for(const job of jobs)for(const item of Array.isArray(job.artifacts)?job.artifacts:[]){
      const record=asObj(item)
      const id=typeof record.id==='string'?record.id:''
      const kind=registeredKinds.get(id)
      if(!kind||sources.has(id)||record.state!=='ready'||typeof record.key!=='string'||
        typeof record.bytes!=='number'||!Number.isFinite(record.bytes)||
        record.bytes<0||record.bytes>25*1024*1024)continue
      sources.set(id,{key:record.key,mime:typeof record.mime==='string'?record.mime:'',
        kind,bytes:record.bytes})
    }
    console.info('[motion-studio:load]',{kind:'source-map',projectId,assets:manifest.assets.length,
      resolved:sources.size,elapsedMs:Date.now()-started})
    return {workspaceId,manifest,sources}
  })()
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
  const {manifest,sources}=await sceneSourceContext(projectId,versionId)
  const scene=manifest.scenes.find(s=>s.bundleAssetId===bundleAssetId)
  if(!scene)fail('Bundle is not part of this immutable version')
  // Named font/media resources use the SAME signed path as scene code.
  // Only assets already declared in the immutable project can be requested.
  if(file.startsWith('_asset/')){
    const parts=file.split('/')
    if(parts.length!==2)fail('Invalid signed scene asset path',404)
    const assetId=parts[1]!
    // Source map is the immutable version's allowlist. No extra DB check.
    const source=sources.get(assetId)
    if(!source)fail('Asset not declared in scene project',404)
    const bytes=await cachedAssetBytes(projectId,versionId,assetId)
    let mime=source.mime
    // Producer uploads may include a charset or use text/plain for VTT/JSON.
    // Accept these only for declared caption/text assets; never permit arbitrary
    // HTML or JS uploads to run inside the signed scene.
    const declaredKind=source.kind
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
  // Published bundle maps requested paths to approved storage assets.
  // Playback does not re-run upload-time content hashes for every file.
  const raw=await cachedAssetBytes(projectId,versionId,bundleAssetId)
  let bundle:Record<string,unknown>
  try{bundle=asObj(JSON.parse(raw.toString('utf8')))}catch{fail('Invalid scene bundle',422)}
  const files=asObj(bundle.files),info=asObj(files[file])
  const nativeId=typeof info.asset==='string'?info.asset:''
  const aliases=manifest.producerAssetMap||{}
  const storedId=aliases[nativeId]||nativeId
  // Keep the immutable source-map allowlist and path confinement; do not
  // repeat digest/registration verification on each playback request.
  if(!safeId(nativeId)||!safeId(storedId)||!sources.has(storedId))
    fail('Scene file is not part of this published project',404)
  let bytes=await cachedAssetBytes(projectId,versionId,storedId)
  if (info.packSha256 !== undefined) {
    const offset=Number(info.offset), length=Number(info.bytes)
    if (!Number.isSafeInteger(offset) || offset<0 || !Number.isSafeInteger(length) ||
        length<1 || offset+length>bytes.length) fail('Invalid packed frame',422)
    bytes=bytes.subarray(offset,offset+length)
  }
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
  // Diagnostic-only scene bootstrap. Runs inside the existing opaque-origin
  // sandbox and reports milestone timings to its parent without exposing URLs
  // or project data. Only inject into HTML; leave JS, assets and render output
  // unchanged. Inline script is already permitted by this sandbox CSP.
  let responseBytes=bytes
  if(process.env.MOTION_STUDIO_BOOT_TIMING!=='false'&&file==='index.html'&&bytes.length<1_000_000){
    const html=bytes.toString('utf8')
    const snippet=`<script>(function(){
      var started=performance.now(),sent={};
      function report(stage,extra){
        if(sent[stage])return;sent[stage]=true;
        try{parent.postMessage({ms:1,event:'boot-timing',stage:stage,
          elapsedMs:Math.round(performance.now()-started),
          count:extra&&extra.count||0,
          maxMs:extra&&extra.maxMs||0},'*')}catch(e){}
      }
      report('runtime-start');
      var longTasks=[];
      try{
        new PerformanceObserver(function(list){
          list.getEntries().forEach(function(e){longTasks.push(e.duration)});
        }).observe({type:'longtask',buffered:true});
      }catch(e){}
      function cpuSnapshot(label){
        var max=longTasks.reduce(function(n,t){return Math.max(n,t)},0);
        report(label,{count:longTasks.length,maxMs:Math.round(max)});
      }
      setTimeout(function(){cpuSnapshot('cpu-snapshot-6s')},6000);
      setTimeout(function(){cpuSnapshot('cpu-snapshot-11s')},11000);
      window.addEventListener('message',function(e){
        if(e.data&&e.data.ms===1&&e.data.method==='init')report('runtime-init-message');
        if(e.data&&e.data.ms===1&&e.data.method==='seek')report('first-render-call');
      },true);
      document.addEventListener('DOMContentLoaded',function(){report('dom-ready')},{once:true});
      window.addEventListener('load',function(){
        var entries=performance.getEntriesByType('resource');
        report('window-load',{count:entries.length,maxMs:Math.round(entries.reduce(function(m,e){return Math.max(m,e.duration||0)},0))});
        if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){report('fonts-ready')});
        var images=Array.prototype.slice.call(document.images||[]);
        Promise.all(images.map(function(img){return img.complete?Promise.resolve():new Promise(function(done){
          img.addEventListener('load',done,{once:true});
          img.addEventListener('error',done,{once:true});
        })})).then(function(){report('images-ready',{count:images.length})});
      },{once:true});
    })();</script>`
    const head=/<head(?:\s[^>]*)?>/i
    if(head.test(html))responseBytes=Buffer.from(html.replace(head,match=>match+snippet),'utf8')
    else console.info('[motion-studio:load]',{kind:'index-instrumentation',status:'missing-head',projectId})
  }
  // index.html is the only route the browser knows initially. Hint its
  // approved JS/CSS siblings immediately, instead of discovering each file
  // sequentially after fetching and evaluating the previous script.
  const preload=file==='index.html'
    ? Object.keys(files).filter(name=>name!=='index.html'&&
        /\.(?:js|mjs|css)$/.test(name)&&name.length<256&&
        name.split('/').every(part=>/^[A-Za-z0-9_.@+\-\[\]]+$/.test(part)))
        .slice(0,12).map(name=>
          '<'+prefix+name.split('/').map(encodeURIComponent).join('/')+
          '>; rel=preload; as='+(name.endsWith('.css')?'style':'script'))
        .join(', ')
    : ''
  if(preload)console.info('[motion-studio:load]',{kind:'index-preload',
    projectId,count:preload.split(', ').length})
  return new Response(new Uint8Array(responseBytes),{status:200,headers:{
    ...(preload?{'Link':preload}:{}),
    'Content-Type':contentType(file),'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'*',
    'Cross-Origin-Resource-Policy':'cross-origin',
    'Referrer-Policy':'no-referrer',
    'Cache-Control':'private, max-age=300',
    'Content-Disposition':'inline',
    'Content-Security-Policy':csp,
  }})
}
