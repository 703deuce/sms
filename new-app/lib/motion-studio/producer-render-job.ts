/**
 * Deterministic re-render request compiled from a saved editable Transovo
 * version. The original producer project document is immutable; the override
 * patch is composed on top without discarding source code or older versions.
 *
 * This is a pure contract adapter: scheduling, storage, rendering and publish
 * are separate durable operations, never hidden inside this function.
 */
import { validatePortableManifest, type MsPortableManifest } from './portable-contract'
import { validateNativeProducerEnvelope } from './producer-project-adapter'

export type DeterministicProducerJob = {
  schema:'transovo.motion-job/1'
  mode:'deterministic_render'
  projectId:string
  baseVersion:number
  edits:{schema:'transovo.edit-patch/1';theme?:Record<string,unknown>;scenes?:Record<string,unknown>}
  output:{master:true;previews:true}
  dryRun:boolean
}
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x)) as T
function fail(message:string): never {throw new Error('Deterministic producer job: '+message)}
const has=(o:Record<string,unknown>,k:string)=>Object.prototype.hasOwnProperty.call(o,k)
export function buildDeterministicProducerJob(args:{
  manifest:MsPortableManifest
  theme:unknown
  overrides:unknown
  dryRun?:boolean
}):DeterministicProducerJob{
  const manifest=validatePortableManifest(args.manifest)
  const source=validateNativeProducerEnvelope(manifest.producerDocument)
  if(source.projectId!==manifest.projectId)fail('producer document belongs to another project')
  if(!object(args.theme)||!object(args.overrides))fail('invalid current theme or edit overrides')
  const edits:DeterministicProducerJob['edits']={schema:'transovo.edit-patch/1'}
  // Producer theme may include rich colors and engine-specific font faces.
  // The producer's v1 document already contains the original design values.
  // Only changed token values should be sent to avoid overwriting metadata.
  const updated=copy(args.theme)
  const original=copy(source.theme)
  const delta:Record<string,unknown>={}
  for(const token of ['colors','fonts','brand']){
    const current=updated[token],baseline=original[token]
    if(!object(current))continue
    const baselineObj=object(baseline)?baseline:{}
    const changed:Record<string,unknown>={}
    for(const [name,value] of Object.entries(current)){
      if(JSON.stringify(value)!==JSON.stringify(baselineObj[name]))changed[name]=value
    }
    if(Object.keys(changed).length)delta[token]=changed
  }
  if(Object.keys(delta).length)edits.theme=delta
  const scenes=object(args.overrides.scenes)?args.overrides.scenes:{}
  const expectedIds=new Set(manifest.scenes.map(scene=>scene.id))
  const patchedScenes:Record<string,unknown>={}
  for(const [sceneId,patch] of Object.entries(scenes)){
    if(!expectedIds.has(sceneId)||!object(patch))fail('edit references an unknown scene')
    if(!has(patch,'elements'))continue
    const elements=patch.elements
    if(!object(elements))fail('invalid editable elements patch')
    patchedScenes[sceneId]=copy({elements})
  }
  if(Object.keys(patchedScenes).length)edits.scenes=patchedScenes
  // Export is an explicit customer action. It is valid even when the live
  // project has no override patch; the original project is still editable.
  return {
    schema:'transovo.motion-job/1',mode:'deterministic_render',
    projectId:source.projectId,baseVersion:source.version,
    edits,output:{master:true,previews:true},dryRun:args.dryRun===true,
  }
}
