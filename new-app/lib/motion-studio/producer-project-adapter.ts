/**
 * Lossless bridge between the existing producer's transovo.motion-project/1
 * and the Transovo portable editor representation. No source code, original
 * clip, narration track, assembly recipe or font record is rewritten.
 *
 * Producer scenes have bundles rather than inline manifests; a trusted
 * bundle ingest step must supply the verified editable-elements manifests.
 * No placeholder scene, invented hash, or silent fallback is allowed.
 */
import { validatePortableManifest, type MsEditElement, type MsPortableManifest } from './portable-contract'

export type ProducerAssetRecord = { id:string; sha256:string; kind:string; storageId?:string }
export type ProducerSceneBundle = {
  sceneId:string
  bundleId:string
  sha256:string
  engine:string
  runtime:string
  manifest: { elements: MsEditElement[]; livePreview?: Record<string,unknown> }
  dependencies?:string[]
}
export type NativeProducerDocument = Record<string,unknown> & {
  schema:'transovo.motion-project/1'
  projectId:string
  version:number
  parentVersion:number|null
  format: Record<string,unknown>
  scenes: Array<Record<string,unknown>>
  theme:Record<string,unknown>
  overrides:Record<string,unknown>
  master:Record<string,unknown>
  assetRefs:string[]
}
type ProducerImport = {
  document:unknown
  assets:ProducerAssetRecord[]
  bundles:ProducerSceneBundle[]
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
function reject(m:string): never {throw new Error('Producer project bridge: '+m)}
const ID=/^[A-Za-z0-9_.:-]{1,128}$/
const sha=/^[0-9a-f]{64}$/i
const id=(x:unknown):x is string=>typeof x==='string'&&ID.test(x)

/** Strict envelope validation, not a replacement for producer's full JSON Schema. */
export function validateNativeProducerEnvelope(value:unknown):NativeProducerDocument{
  if(!object(value)||value.schema!=='transovo.motion-project/1'||!id(value.projectId)||
     !Number.isSafeInteger(value.version)||Number(value.version)<1||
     !(value.parentVersion===null||
       (Number.isSafeInteger(value.parentVersion)&&Number(value.parentVersion)>=1&&Number(value.parentVersion)<Number(value.version)))||
     !object(value.format)||!Array.isArray(value.scenes)||value.scenes.length<1||
     value.scenes.length>1000||!object(value.theme)||!object(value.overrides)||
     !object(value.master)||!id(value.master.asset)||!id(value.master.recipe)||
     !Array.isArray(value.assetRefs)||value.assetRefs.length>10000||
     value.assetRefs.some(v=>!id(v)))
    reject('invalid producer document envelope')
  const used=new Set<string>()
  for(const scene of value.scenes){
    if(!object(scene)||!id(scene.sceneId)||used.has(scene.sceneId)||
       !id(scene.bundle)||!object(scene.clip)||!id(scene.clip.asset))
      reject('invalid producer scene')
    used.add(scene.sceneId)
  }
  return value as NativeProducerDocument
}
export function adaptProducerProject(input:ProducerImport):MsPortableManifest{
  const native=validateNativeProducerEnvelope(input.document)
  if(!Array.isArray(input.assets)||!Array.isArray(input.bundles))reject('missing ingest metadata')
  const assetMap=new Map<string,ProducerAssetRecord>()
  const storageIds=new Set<string>()
  for(const item of input.assets){
    if(!object(item)||!id(item.id)||!sha.test(String(item.sha256))||
       !id(item.kind)||!id(item.storageId||item.id)||assetMap.has(item.id)||
       storageIds.has(item.storageId||item.id))reject('invalid or duplicate asset')
    assetMap.set(item.id,item)
    storageIds.add(item.storageId||item.id)
  }
  // Do not lose the native project's stems/assembly/font/source references.
  for(const ref of native.assetRefs)if(!assetMap.has(ref))reject('native asset missing: '+ref)
  const critical=[native.master.asset,native.master.recipe]
  for(const ref of critical)if(!id(ref)||!assetMap.has(ref))reject('master asset missing: '+ref)
  const bundleMap=new Map<string,ProducerSceneBundle>()
  for(const b of input.bundles){
    if(!object(b)||!id(b.sceneId)||bundleMap.has(b.sceneId)||!id(b.bundleId)||
       !sha.test(String(b.sha256))||!id(b.engine)||!id(b.runtime)||
       !object(b.manifest)||!Array.isArray(b.manifest.elements)||
       (b.dependencies!==undefined&&(!Array.isArray(b.dependencies)||b.dependencies.some(x=>!id(x)))))
      reject('invalid scene bundle ingest record')
    const stored=assetMap.get(b.bundleId)
    if(!stored||stored.sha256.toLowerCase()!==b.sha256.toLowerCase())
      reject('scene bundle SHA-256 mismatch')
    for(const d of b.dependencies||[])if(!assetMap.has(d))reject('scene dependency missing: '+d)
    bundleMap.set(b.sceneId,b)
  }
  if(bundleMap.size!==native.scenes.length)reject('scene bundle count mismatch')
  const scenes:MsPortableManifest['scenes']=[]
  for(const scene of native.scenes){
    const sceneId=String(scene.sceneId), bundle=bundleMap.get(sceneId)
    if(!bundle||scene.bundle!==bundle.bundleId)reject('scene source bundle mismatch: '+sceneId)
    if(!assetMap.has(String((scene.clip as Record<string,unknown>).asset)))
      reject('scene clip missing: '+sceneId)
    scenes.push({id:sceneId,bundleAssetId:assetMap.get(bundle.bundleId)!.storageId||bundle.bundleId,bundleSha256:bundle.sha256,
      engine:bundle.engine,runtime:bundle.runtime,manifest:bundle.manifest,
      dependencies:(bundle.dependencies||[]).map(nativeId=>assetMap.get(nativeId)!.storageId||nativeId)})
  }
  const manifest={
    format:'motion-studio-portable/1' as const,
    projectId:native.projectId,
    scenes,
    // The producer may use fnt_/bnd_/ast_ content-addressed IDs while the
    // existing Transovo database uses separately scoped storage IDs.
    assets:[...assetMap.values()].map(a=>({id:a.storageId||a.id,sha256:a.sha256,kind:a.kind})),
    producerAssetMap:Object.fromEntries([...assetMap.values()].map(a=>[a.id,a.storageId||a.id])),
    // Preserve the entire producer document verbatim. New editor metadata is
    // additive, never a replacement for timeline, narration or master recipes.
    producerDocument:native,
    runtime:object(native.runtimeLock)?native.runtimeLock:
      {nativeRuntimeLock:native.runtimeLock??null},
    timeline: {nativeScenePlacements:native.scenes.map(s=>({
      sceneId:s.sceneId,timeline:s.timeline??null}))},
    audio: native.sources??null,
  }
  return validatePortableManifest(manifest)
}
