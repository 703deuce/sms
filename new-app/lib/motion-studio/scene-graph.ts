/**
 * Motion Studio scene graph v1 (additive, engine-neutral).
 *
 * Describes objects and editable animation without requiring a renderer rewrite.
 * A producer may keep custom Three/Pixi/Python/Skia source in its immutable
 * scene bundle; a node points at that engine-specific component instead of
 * forcing arbitrary source code to be translated to primitive shapes.
 *
 * Existing transovo.editable-elements/1 and motion-studio-portable/1 documents
 * are valid without a graph. Keys and IDs are stable across AI/manual revisions.
 */
export type MotionPrimitive = string | number | boolean | number[] | null
export type MotionInterpolation = 'hold' | 'linear' | 'bezier'
export type MotionKeyframe = {
  id: string
  timeMs: number
  value: MotionPrimitive
  interpolation?: MotionInterpolation
  easing?: { in?: [number, number]; out?: [number, number] }
}
export type MotionAnimatedProperty = {
  type: 'number' | 'boolean' | 'text' | 'color' | 'vec2' | 'vec3' | 'enum'
  value: MotionPrimitive
  keyframes?: MotionKeyframe[]
  /** Expressions are declarative references only; never evaluated as code in the app. */
  expression?: { language: 'javascript'; sourceAssetId: string; enabled: boolean }
  editable?: boolean
}
export type MotionEffect = {
  id: string
  type: string
  enabled: boolean
  properties: Record<string, MotionAnimatedProperty>
  /** Optional external renderer component, never raw executable source text. */
  component?: { engine: string; sourceAssetId: string; exportName?: string }
}
export type MotionNode = {
  id: string
  name: string
  kind: 'composition' | 'group' | 'text' | 'shape' | 'image' | 'video' | 'camera' | 'light' | 'component'
  parentId?: string
  enabled?: boolean
  startMs?: number
  endMs?: number
  properties: Record<string, MotionAnimatedProperty>
  effects?: MotionEffect[]
  component?: { engine: string; sourceAssetId: string; exportName?: string }
}
export type MotionSceneGraph = {
  schema: 'transovo.motion-scene-graph/1'
  rootId: string
  durationMs: number
  nodes: MotionNode[]
}

const isObject = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
const ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/
const HASH_ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/
const okId = (x: unknown) => typeof x === 'string' && ID.test(x)
const fail = (m: string): never => { throw new Error('Motion scene graph: ' + m) }
const nonnegative = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
const valueOk = (type: MotionAnimatedProperty['type'], v: unknown): boolean => {
  if (v === null) return true
  if (type === 'number') return finite(v)
  if (type === 'boolean') return typeof v === 'boolean'
  if (type === 'text' || type === 'enum') return typeof v === 'string' && v.length <= 4000
  if (type === 'color') return typeof v === 'string' && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(v)
  if (type === 'vec2' || type === 'vec3')
    return Array.isArray(v) && v.length === (type === 'vec2' ? 2 : 3) && v.every(finite)
  return false
}
const keyframeCurve = (v: unknown): boolean =>
  Array.isArray(v) && v.length === 2 && v.every(x => finite(x) && x >= 0 && x <= 1)
function validateProperty(raw: unknown, validAssetIds: Set<string>, durationMs: number) {
  if (!isObject(raw) || !['number','boolean','text','color','vec2','vec3','enum'].includes(String(raw.type)) ||
      !valueOk(raw.type as MotionAnimatedProperty['type'], raw.value))
    fail('invalid property value or type')
  if (raw.editable !== undefined && typeof raw.editable !== 'boolean') fail('invalid editable flag')
  if (raw.expression !== undefined) {
    if (!isObject(raw.expression) || raw.expression.language !== 'javascript' ||
        !validAssetIds.has(String(raw.expression.sourceAssetId)) ||
        typeof raw.expression.enabled !== 'boolean') fail('invalid expression source reference')
  }
  if (raw.keyframes === undefined) return
  if (!Array.isArray(raw.keyframes) || raw.keyframes.length > 10000) fail('invalid keyframe sequence')
  const seen = new Set<string>()
  let prev = -1
  for (const k of raw.keyframes) {
    if (!isObject(k) || !okId(k.id) || seen.has(k.id) ||
        !nonnegative(k.timeMs) || k.timeMs > durationMs || k.timeMs <= prev ||
        !valueOk(raw.type as MotionAnimatedProperty['type'], k.value) ||
        (k.interpolation !== undefined && !['hold','linear','bezier'].includes(String(k.interpolation))))
      fail('invalid, duplicate, or out-of-order keyframe')
    if (k.easing !== undefined &&
      (!isObject(k.easing) ||
        (k.easing.in !== undefined && !keyframeCurve(k.easing.in)) ||
        (k.easing.out !== undefined && !keyframeCurve(k.easing.out))))
      fail('invalid easing curve')
    seen.add(k.id);prev = k.timeMs as number
  }
}
function validateProperties(props: unknown, assets: Set<string>, durationMs: number) {
  if (!isObject(props) || Object.keys(props).length > 300) fail('invalid property collection')
  for (const [key, value] of Object.entries(props)) {
    if (!okId(key)) fail('invalid property name')
    validateProperty(value, assets, durationMs)
  }
}
function validateComponent(value: unknown, assets: Set<string>) {
  if (!isObject(value) || !okId(value.engine) ||
      !HASH_ID.test(String(value.sourceAssetId)) || !assets.has(String(value.sourceAssetId)) ||
      (value.exportName !== undefined && !okId(value.exportName)))
    fail('invalid external component reference')
}
export function validateMotionSceneGraph(value: unknown, registeredAssets: Iterable<string>): MotionSceneGraph {
  if (!isObject(value) || value.schema !== 'transovo.motion-scene-graph/1' ||
      !okId(value.rootId) || !nonnegative(value.durationMs) || value.durationMs === 0 ||
      !Array.isArray(value.nodes) || value.nodes.length === 0 || value.nodes.length > 10000)
    fail('invalid graph header')
  // Bound the graph before traversing it. The caller also limits the enclosing manifest.
  const json = JSON.stringify(value)
  if (!json || json.length > 1_000_000 ||
      /(?:__proto__|constructor|prototype)/.test(json) ||
      /(?:\/workspace\/|file:\/\/|[?&](?:X-Amz-|X-Goog-|Signature=|access_token=))/i.test(json))
    fail('unsafe or oversized graph')
  const assets = new Set(registeredAssets)
  const nodes = new Map<string, Record<string, unknown>>()
  for (const n of value.nodes) {
    if (!isObject(n) || !okId(n.id) || nodes.has(String(n.id)) ||
        typeof n.name !== 'string' || n.name.length > 256 ||
        !['composition','group','text','shape','image','video','camera','light','component'].includes(String(n.kind)) ||
        (n.parentId !== undefined && !okId(n.parentId)) ||
        (n.enabled !== undefined && typeof n.enabled !== 'boolean') ||
        (n.startMs !== undefined && !nonnegative(n.startMs)) ||
        (n.endMs !== undefined && (!nonnegative(n.endMs) || n.endMs > value.durationMs)) ||
        (n.startMs !== undefined && n.endMs !== undefined && n.endMs <= n.startMs))
      fail('invalid or duplicate node')
    validateProperties(n.properties, assets, value.durationMs as number)
    if (n.component !== undefined) validateComponent(n.component, assets)
    if (n.kind === 'component' && n.component === undefined) fail('component node missing engine reference')
    if (n.effects !== undefined) {
      if (!Array.isArray(n.effects) || n.effects.length > 100) fail('invalid effects collection')
      const effectIds = new Set<string>()
      for (const fx of n.effects) {
        if (!isObject(fx) || !okId(fx.id) || !okId(fx.type) || effectIds.has(String(fx.id)) ||
            typeof fx.enabled !== 'boolean') fail('invalid or duplicate effect')
        validateProperties(fx.properties, assets, value.durationMs as number)
        if (fx.component !== undefined) validateComponent(fx.component, assets)
        effectIds.add(fx.id as string)
      }
    }
    nodes.set(n.id as string, n)
  }
  const root = nodes.get(String(value.rootId))
  if (!root || root.kind !== 'composition' || root.parentId !== undefined)
    fail('root must be a top-level composition')
  // Every node must reach the root: rejects missing parents, cycles and
  // disconnected graphs without relying on deep recursion.
  const done = new Set<string>([String(value.rootId)])
  for (const id of nodes.keys()) {
    let cursor: string | undefined = id
    const visiting = new Set<string>()
    while (cursor && !done.has(cursor)) {
      if (visiting.has(cursor)) fail('cycle in parent hierarchy')
      visiting.add(cursor)
      const current = nodes.get(cursor)
      if (!current) fail('missing parent node')
      cursor = typeof current.parentId === 'string' ? current.parentId : undefined
    }
    if (!cursor) fail('node is disconnected from root')
    for (const k of visiting) done.add(k)
  }
  return value as MotionSceneGraph
}
