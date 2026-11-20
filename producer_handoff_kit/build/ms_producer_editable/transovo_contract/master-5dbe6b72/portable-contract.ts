/**
 * Motion Studio portable scene contract v1.
 * The producer owns scene code and the props resolver. Transovo owns stable
 * asset identities, immutable versions, validation and edit authorization.
 */
import { validateMotionSceneGraph, type MotionSceneGraph } from './scene-graph'

export type MsEditTier = 'live_editable' | 'render_editable' | 'ai_editable' | 'protected'
export type MsPropertyKind = 'text' | 'color' | 'number' | 'boolean' | 'point' | 'image' | 'font' | 'enum'
export type MsEditProperty = {
  tier: MsEditTier
  type: MsPropertyKind
  default?: unknown
  bind?: string
  min?: number
  max?: number
  maxChars?: number
  maxCharsPerLine?: number
  maxLines?: number
  autoFitMin?: number
  choices?: string[]
  values?: string[]
  enum?: string[]
  formats?: string[]
}
export type MsEditElement = {
  id: string
  kind: string
  timing?: { inSec: number; outSec: number }
  properties: Record<string, MsEditProperty>
}
export type MsPortableScene = {
  id: string
  bundleAssetId: string
  bundleSha256: string
  engine: string
  runtime: string
  manifest: { elements: MsEditElement[]; livePreview?: Record<string, unknown>; motionTree?: MotionSceneGraph }
  dependencies?: string[]
}
export type MsPortableManifest = {
  format: 'motion-studio-portable/1'
  projectId: string
  scenes: MsPortableScene[]
  assets: { id: string; sha256: string; kind: string }[]
  runtime?: Record<string, unknown>
  timeline?: unknown
  audio?: unknown
  captions?: unknown
  /** Shared browser timeline, containing registered asset IDs rather than URLs. */
  liveProject?: Record<string,unknown>
  /** Producer v1 retained losslessly for a deterministic re-render. */
  producerDocument?: Record<string,unknown>
  /** Producer content-hash IDs to Transovo's tenant-scoped upload IDs. */
  producerAssetMap?: Record<string,string>
}
const ID = /^[a-zA-Z0-9_.:-]{1,128}$/
const SHA = /^[a-f0-9]{64}$/i
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const safeText = (v: string) => !/(?:https?:\/\/|file:\/\/|(?:^|\s)\.{1,2}\/|\/workspace\/|\/tmp\/)/i.test(v)
function fail(message: string): never { throw new Error(message) }
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)
const assetId = (v: unknown): v is string => isId(v) && v.length <= 128

function enforceBoundedJson(value: unknown, maxBytes: number, name: string) {
  const json = JSON.stringify(value)
  if (!json || new TextEncoder().encode(json).length > maxBytes) fail(name + ' exceeds its size limit')
  // Check actual object KEYS, not story text. A documentary is allowed to
  // mention a constructor or prototype without being flagged as an attack.
  const queue:unknown[]=[value]
  let visited=0
  while(queue.length){
    const current=queue.pop()
    if(!current||typeof current!=='object')continue
    if(++visited>250000)fail(name + ' contains too many nested values')
    if(Array.isArray(current)){for(const item of current)queue.push(item);continue}
    for(const [key,child] of Object.entries(current)){
      if(['__proto__','constructor','prototype'].includes(key))
        fail(name + ' contains a prohibited key')
      if(child&&typeof child==='object')queue.push(child)
    }
  }
  // Never persist a transient signed download URL, arbitrary local path or credentials.
  if (/(?:[?&](?:X-Amz-|X-Goog-|Signature=|access_token=|token=)|\/workspace\/|file:\/\/)/i.test(json))
    fail(name + ' contains a temporary URL or local file path')
}
export function validatePortableManifest(value: unknown): MsPortableManifest {
  if (!plain(value) || value.format !== 'motion-studio-portable/1' || !isId(value.projectId))
    return fail('Unsupported portable project manifest')
  if (!Array.isArray(value.scenes) || value.scenes.length === 0 || value.scenes.length > 1000)
    return fail('Portable project must contain 1–1000 scenes')
  if (!Array.isArray(value.assets) || value.assets.length > 10000)
    return fail('Invalid portable project assets')
  const ids = new Set<string>()
  for (const item of value.assets) {
    if (!plain(item) || !assetId(item.id) || typeof item.sha256 !== 'string' || !SHA.test(item.sha256) ||
        typeof item.kind !== 'string' || !isId(item.kind) || ids.has(item.id))
      return fail('Invalid or duplicate portable asset')
    ids.add(item.id)
  }
  const sceneIds = new Set<string>()
  for (const scene of value.scenes) {
    if (!plain(scene) || !isId(scene.id) || sceneIds.has(scene.id) ||
        !assetId(scene.bundleAssetId) || !ids.has(scene.bundleAssetId) ||
        typeof scene.bundleSha256 !== 'string' || !SHA.test(scene.bundleSha256) ||
        !isId(scene.engine) || !isId(scene.runtime) || !plain(scene.manifest) ||
        !Array.isArray(scene.manifest.elements) || scene.manifest.elements.length > 1000)
      return fail('Invalid or duplicate portable scene')
    sceneIds.add(scene.id)
    if (scene.dependencies !== undefined &&
        (!Array.isArray(scene.dependencies) || scene.dependencies.some(x => !assetId(x) || !ids.has(x))))
      return fail('Scene references an unregistered asset')
    // Optional additive After Effects-style tree. Legacy producer manifests stay
    // valid and preserve the original immutable source bundle unchanged.
    if (scene.manifest.motionTree !== undefined) {
      const registeredAssets = new Set(value.assets.map(a => a.id))
      validateMotionSceneGraph(scene.manifest.motionTree, registeredAssets)
    }
    const elementIds = new Set<string>()
    for (const el of scene.manifest.elements) {
      if (!plain(el) || !isId(el.id) || !isId(el.kind) || elementIds.has(el.id) || !plain(el.properties))
        return fail('Invalid or duplicate editable element')
      elementIds.add(el.id)
      for (const [name, prop] of Object.entries(el.properties)) {
        if (!isId(name) || !plain(prop) ||
            !['live_editable','render_editable','ai_editable','protected'].includes(String(prop.tier)) ||
            !['text','color','number','boolean','point','image','font','enum'].includes(String(prop.type)))
          return fail('Invalid editable property declaration')
      }
    }
  }
  if(value.liveProject!==undefined){
    const live=value.liveProject
    if(!plain(live)||live.schema!=='transovo.live-project/1'||
       live.projectId!==value.projectId||!plain(live.format)||
       !Array.isArray(live.tracks)||live.tracks.length>100||
       !Number.isSafeInteger(live.format.durationMs)||
       Number(live.format.durationMs)<1||Number(live.format.durationMs)>2_147_483_647)
      return fail('Invalid live browser timeline')
    let count=0
    for(const entry of live.tracks){
      if(!plain(entry)||!Array.isArray(entry.items))return fail('Invalid browser timeline track')
      const captionAsset=entry.captions
      if(captionAsset!==undefined&&(!assetId(captionAsset)||!ids.has(captionAsset)))
        return fail('Caption track references an unregistered project asset')
      for(const item of entry.items){
        if(++count>20000||!plain(item))return fail('Too many browser timeline items')
        const src=item.assetId??item.src
        if(src!==undefined&&(!assetId(src)||!ids.has(src)))
          return fail('Timeline media must reference a registered asset ID')
        if(typeof item.startMs!=='number'||!Number.isSafeInteger(item.startMs)||item.startMs<0||
           typeof item.durationMs!=='number'||!Number.isSafeInteger(item.durationMs)||item.durationMs<0)
          return fail('Invalid timeline item timing')
        if(item.type==='scene'&&!sceneIds.has(String(item.sceneId??item.id)))
          return fail('Timeline references an unknown scene')
      }
    }
  }
  if (value.producerDocument !== undefined || value.producerAssetMap !== undefined) {
    if (!plain(value.producerDocument) || value.producerDocument.schema !== 'transovo.motion-project/1' ||
        value.producerDocument.projectId !== value.projectId ||
        !plain(value.producerAssetMap))
      return fail('Invalid native producer source')
    const producer = value.producerDocument
    const aliases = value.producerAssetMap as Record<string,unknown>
    if (!Array.isArray(producer.assetRefs) || producer.assetRefs.length > 10000 ||
        producer.assetRefs.some(ref=>!assetId(ref)||!assetId(aliases[ref])||
          !ids.has(aliases[ref] as string)))
      return fail('Native project references an unregistered asset')
    if (Object.entries(aliases).some(([ref,storageId])=>!assetId(ref)||!assetId(storageId)||
        !ids.has(storageId as string)))
      return fail('Invalid producer asset alias')
  }
  enforceBoundedJson(value, 2_000_000, 'Portable manifest')
  return value as unknown as MsPortableManifest
}
export function validateScenePropertyPatch(
  manifest: MsPortableManifest, sceneId: string, patch: unknown,
  mode: 'live' | 'render' = 'render'
): { patch: Record<string, Record<string, unknown>>; requiresRender: boolean } {
  const scene = manifest.scenes.find(s => s.id === sceneId)
  if (!scene || !plain(patch)) return fail('Scene or property patch not found')
  const clean: Record<string, Record<string, unknown>> = Object.create(null)
  let requiresRender = false
  for (const [elementId, values] of Object.entries(patch)) {
    const element = scene.manifest.elements.find(e => e.id === elementId)
    if (!element || !plain(values)) return fail('Unknown editable element')
    const out: Record<string, unknown> = Object.create(null)
    for (const [key, value] of Object.entries(values)) {
      // Timing is a graph-native editable range, not a producer property.
      // Save as an override so source bundles and keyframes remain immutable.
      if (key === 'startMs' || key === 'endMs') {
        const graph = scene.manifest.motionTree
        const node = graph?.nodes.find(n => n.id === elementId && n.id !== graph.rootId)
        if (!node || !Number.isSafeInteger(value) || (value as number) < 0 ||
            (value as number) > graph!.durationMs)
          return fail('Layer timing outside scene bounds')
        out[key] = value
        continue
      }
      const spec = element.properties[key]
      if (!spec || spec.tier === 'protected' || spec.tier === 'ai_editable')
        return fail('Property requires an AI revision or is protected')
      if (mode === 'live' && spec.tier !== 'live_editable')
        return fail('Property requires a deterministic worker render')
      if (spec.tier === 'render_editable') requiresRender = true
      if (value === null) { out[key] = null; continue } // remove inherited override
      if (spec.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) ||
          (spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)))
        return fail('Numeric property outside safe bounds')
      if (spec.type === 'boolean' && typeof value !== 'boolean') return fail('Expected boolean')
      if (['text','font','color','image','enum'].includes(spec.type)) {
        if (typeof value !== 'string' || value.length > 2048 || !safeText(value))
          return fail('Invalid string property')
        if (spec.type === 'text') {
          if (spec.maxChars !== undefined && value.length > spec.maxChars)
            return fail('Text is too long')
          const lines=value.split(/\r?\n/)
          if (spec.maxLines !== undefined && lines.length > spec.maxLines)
            return fail('Text has too many lines')
          if (spec.maxCharsPerLine !== undefined &&
              lines.some(line=>line.length>spec.maxCharsPerLine!))
            return fail('Text line exceeds its safe width')
        }
        if (spec.type === 'color' && !/^#[0-9a-f]{6}$/i.test(value)) return fail('Invalid color')
        if (spec.type === 'image' && !idsContain(manifest, value)) return fail('Image asset not in project')
        const choices = spec.choices ?? spec.values ?? spec.enum
        if (choices && !choices.includes(value)) return fail('Property not supported by scene')
      }
      if (spec.type === 'point' && (!plain(value) || !Number.isFinite(value.x) ||
          !Number.isFinite(value.y) || Number(value.x) < 0 || Number(value.x) > 1 ||
          Number(value.y) < 0 || Number(value.y) > 1))
        return fail('Invalid normalized focal point')
      out[key] = value
    }
    if (out.startMs !== undefined || out.endMs !== undefined) {
      const graph = scene.manifest.motionTree!
      const node = graph.nodes.find(n => n.id === elementId)!
      const start = Number(out.startMs ?? node.startMs ?? 0)
      const end = Number(out.endMs ?? node.endMs ?? graph.durationMs)
      if (end <= start) return fail('Layer end must follow its start')
    }
    clean[elementId] = out
  }
  enforceBoundedJson(clean, 100_000, 'Scene overrides')
  return { patch: clean, requiresRender }
}
function idsContain(manifest: MsPortableManifest, id: string) {
  return manifest.assets.some(a => a.id === id)
}
export function validateThemePatch(patch: unknown): Record<string, unknown> {
  if (!plain(patch)) return fail('Theme patch must be an object')
  for (const key of Object.keys(patch)) if (!['colors','fonts','brand'].includes(key))
    return fail('Unknown theme property')
  if (patch.colors !== undefined) {
    if (!plain(patch.colors)) return fail('Colors must be an object')
    for (const [k,v] of Object.entries(patch.colors)) {
      if (!isId(k) || (v !== null && (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v))))
        return fail('Invalid theme color')
    }
  }
  // Font references are engine-native, supplied and checked by the producer manifest.
  enforceBoundedJson(patch, 32_000, 'Theme patch')
  return patch
}
