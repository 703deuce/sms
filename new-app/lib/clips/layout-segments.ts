import type { ClipEditsV2 } from '@/lib/clips/edits'

export type ProducerBox = {x:number;y:number;w:number;h:number}
export type ProducerPerson = {speakerId:string;box:ProducerBox}
export type ProducerDivider = {color?:string;width?:number;opacity?:number;style?:'solid'|'dashed'}
export type LayoutSegment = {
  /** Source ms. Framing is explicit, never delegated to speaker_follow. */
  focusSpeaker?: string
  cropBox?: ProducerBox
  people?: ProducerPerson[]
  splitRatio?: number
  order?: string[]
  divider?: ProducerDivider
  zoomAnchor?: {x:number;y:number}
  startMs: number
  endMs: number
  mode: ClipEditsV2['layout']['mode']
  /** Q6.2: split-screen toggle added this segment — removed when toggle off. */
  auto?: true
}

export function defaultLayoutSegments(trimIn: number, trimOut: number, mode: ClipEditsV2['layout']['mode']): LayoutSegment[] {
  return [{ startMs: trimIn, endMs: trimOut, mode }]
}

export function normalizeLayoutSegments(
  raw: unknown,
  trimIn: number,
  trimOut: number,
  fallbackMode: ClipEditsV2['layout']['mode'],
): LayoutSegment[] {
  if (!Array.isArray(raw) || !raw.length) {
    return defaultLayoutSegments(trimIn, trimOut, fallbackMode)
  }
  const modes = new Set<ClipEditsV2['layout']['mode']>([
    'speaker_follow',
    'fit_blur',
    'fit_top',
    'full_frame',
    'center_crop',
    'subject_follow',
    'split',
    'fill',
    'fit',
    'grid3',
    'grid4',
    'dynamic',
    'auto',
    'screen_pip',
    'facecam_stack',
    'facecam_pip',
  ])
  const box=(raw:unknown):ProducerBox|undefined=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined
    const v=raw as Record<string,unknown>,x=Number(v.x),y=Number(v.y),w=Number(v.w),h=Number(v.h)
    if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>1.001||y+h>1.001)return undefined
    return {x,y,w,h}
  }
  const segs: LayoutSegment[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string,unknown>
    const startMs = Math.round(Number(r.startMs))
    const endMs = Math.round(Number(r.endMs))
    const mode = modes.has(r.mode as ClipEditsV2['layout']['mode'])
      ? (r.mode as ClipEditsV2['layout']['mode'])
      : fallbackMode
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    segs.push({
      startMs: Math.max(trimIn, startMs),
      endMs: Math.min(trimOut, endMs),
      mode,
      ...(r.auto === true ? { auto: true as const } : {}),
      ...((typeof r.focusSpeaker==='string'||typeof r.focusSpeaker==='number')
        ? {focusSpeaker:String(r.focusSpeaker).slice(0,80)}:{}),
      ...(box(r.cropBox)?{cropBox:box(r.cropBox)}:{}),
      ...(Array.isArray(r.people)?{people:r.people.slice(0,4).flatMap(person=>{
        const p=person&&typeof person==='object'?person as Record<string,unknown>:{}
        const b=box(p.box)
        return b&&(typeof p.speakerId==='string'||typeof p.speakerId==='number')
          ?[{speakerId:String(p.speakerId).slice(0,80),box:b}]:[]
      })}:{}),
      ...(typeof r.splitRatio==='number'&&Number.isFinite(r.splitRatio)
        ?{splitRatio:Math.max(.1,Math.min(.9,r.splitRatio))}:{}),
      ...(Array.isArray(r.order)?{order:r.order.slice(0,4).map(v=>String(v).slice(0,80))}:{}),
      ...(r.divider&&typeof r.divider==='object'&&!Array.isArray(r.divider)?{divider:{
        color:typeof (r.divider as Record<string,unknown>).color==='string'
          ?String((r.divider as Record<string,unknown>).color).slice(0,16):undefined,
        width:Math.max(0,Math.min(32,Number((r.divider as Record<string,unknown>).width)||0)),
        opacity:Math.max(0,Math.min(1,Number((r.divider as Record<string,unknown>).opacity??1))),
        style:(r.divider as Record<string,unknown>).style==='dashed'?'dashed' as const:'solid' as const,
      }}:{}),
      ...((()=>{
        const a=r.zoomAnchor&&typeof r.zoomAnchor==='object'?r.zoomAnchor as Record<string,unknown>:{}
        const x=Number(a.x),y=Number(a.y)
        return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1
          ?{zoomAnchor:{x,y}}:{}
      })()),
    })
  }
  if (!segs.length) return defaultLayoutSegments(trimIn, trimOut, fallbackMode)
  return mergeAdjacentSegments(segs.sort((a, b) => a.startMs - b.startMs))
}

function mergeAdjacentSegments(segs: LayoutSegment[]): LayoutSegment[] {
  const out: LayoutSegment[] = []
  for (const s of segs) {
    const prev = out[out.length - 1]
    if (prev && prev.endMs >= s.startMs - 1 &&
      JSON.stringify({...prev,startMs:0,endMs:0})===JSON.stringify({...s,startMs:0,endMs:0})) {
      prev.endMs = Math.max(prev.endMs, s.endMs)
    } else {
      out.push({ ...s })
    }
  }
  return out
}

export function layoutModeAtSourceMs(edits: ClipEditsV2, sourceMs: number): ClipEditsV2['layout']['mode'] {
  const segs = edits.layout.layoutSegments
  if (!segs?.length) return edits.layout.mode
  const ms = sourceMs
  let hit: LayoutSegment | undefined
  for (const s of segs) {
    if (ms >= s.startMs && ms < s.endMs) hit = s
  }
  return hit?.mode ?? edits.layout.mode
}

export function splitLayoutSegmentAt(edits: ClipEditsV2, sourceMs: number): ClipEditsV2 {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  const ms = Math.round(sourceMs)
  const idx = segs.findIndex((s) => ms > s.startMs + 200 && ms < s.endMs - 200)
  if (idx < 0) return edits
  const s = segs[idx]
  const left:LayoutSegment = {...s,startMs:s.startMs,endMs:ms}
  const right:LayoutSegment = {...s,startMs:ms,endMs:s.endMs}
  const next = [...segs.slice(0, idx), left, right, ...segs.slice(idx + 1)]
  return { ...edits, layout: { ...edits.layout, layoutSegments: next } }
}

export function setLayoutModeForSegmentAt(edits: ClipEditsV2, sourceMs: number, mode: ClipEditsV2['layout']['mode']): ClipEditsV2 {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  const ms = Math.round(sourceMs)
  const idx = segs.findIndex((s) => ms >= s.startMs && ms < s.endMs)
  if (idx < 0) {
    return {
      ...edits,
      layout: { ...edits.layout, mode, userPicked: true, layoutSegments: defaultLayoutSegments(trimIn, trimOut, mode) },
    }
  }
  const next = segs.map((s, i) => (i === idx ? { ...s, mode } : s))
  return { ...edits, layout: { ...edits.layout, layoutSegments: next, userPicked: true } }
}

/** Remove the layout segment under the playhead (merge into neighbors). */
export function deleteLayoutSegmentAt(edits: ClipEditsV2, sourceMs: number): ClipEditsV2 {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  if (segs.length <= 1) return edits
  const ms = Math.round(sourceMs)
  const idx = segs.findIndex((s) => ms >= s.startMs && ms < s.endMs)
  if (idx < 0) return edits
  const removed = segs[idx]
  const neighborMode = segs[idx - 1]?.mode ?? segs[idx + 1]?.mode ?? edits.layout.mode
  const merged: LayoutSegment = {
    startMs: removed.startMs,
    endMs: removed.endMs,
    mode: neighborMode,
  }
  const without = [...segs.slice(0, idx), ...segs.slice(idx + 1)]
  without.splice(idx, 0, merged)
  return {
    ...edits,
    layout: { ...edits.layout, layoutSegments: mergeAdjacentSegments(without) },
  }
}

/** Dominant layout mode by overlap on the trim window (export fallback). */
export function cutRangeForLayoutSegmentAt(edits: ClipEditsV2, sourceMs: number): [number, number] | null {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  const ms = Math.round(sourceMs)
  const seg = segs.find((s) => ms >= s.startMs && ms < s.endMs)
  if (!seg) return null
  return [seg.startMs, seg.endMs]
}

export function dominantLayoutModeForTrim(edits: ClipEditsV2): ClipEditsV2['layout']['mode'] {
  const segs = edits.layout.layoutSegments
  if (!segs?.length) return edits.layout.mode
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  let best = edits.layout.mode
  let bestMs = 0
  for (const s of segs) {
    const a = Math.max(trimIn, s.startMs)
    const b = Math.min(trimOut, s.endMs)
    const len = Math.max(0, b - a)
    if (len > bestMs) {
      bestMs = len
      best = s.mode
    }
  }
  return best
}
