'use client'
import { useEffect, useRef, useState } from 'react'
import type { MsPortableScene } from '@/lib/motion-studio/portable-contract'

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const seconds = (ms: number) => (ms / 1000).toFixed(2)

/** Graph-native layer in/out points. Only changes the unsaved patch; never posts a render. */
export function PortableLayerTiming({scene, layerId, savedElements, patch, onChange}: {
  scene: MsPortableScene
  layerId: string
  savedElements: Record<string, unknown>
  patch: Record<string, Record<string, unknown>>
  onChange: (elementId: string, key: string, value: number) => void
}) {
  const dragging = useRef<'start' | 'end' | null>(null)
  const graph = scene.manifest.motionTree
  const node = graph?.nodes.find(n => n.id === layerId && n.id !== graph.rootId)
  if (!graph || !node || !scene.manifest.elements.some(e => e.id === layerId)) return null
  const saved = object(savedElements[layerId])
  const draft = patch[layerId] || {}
  const duration = graph.durationMs
  const start = Number(draft.startMs ?? saved.startMs ?? node.startMs ?? 0)
  const end = Number(draft.endMs ?? saved.endMs ?? node.endMs ?? duration)
  const changeStart = (ms: number) => onChange(layerId, 'startMs', Math.max(0, Math.min(end - 1, Math.round(ms))))
  const changeEnd = (ms: number) => onChange(layerId, 'endMs', Math.min(duration, Math.max(start + 1, Math.round(ms))))
  return <fieldset className="rounded-md border border-border p-2" data-testid="ms-layer-timing">
    <legend className="px-1 text-xs font-semibold">Layer timing · {node.name}</legend>
    <div className="grid grid-cols-2 gap-2">
      <SecondsField key={layerId+':start'} label="Start (seconds)" ms={start}
        minMs={0} maxMs={end-1} onCommit={changeStart} />
      <SecondsField key={layerId+':end'} label="End (seconds)" ms={end}
        minMs={start+1} maxMs={duration} onCommit={changeEnd} />
    </div>
    <div className="relative mt-3 h-8 cursor-ew-resize rounded bg-muted touch-none"
      aria-label="Drag layer timing handles"
      onPointerDown={e => {
        const bounds=e.currentTarget.getBoundingClientRect()
        const ms=Math.round(Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width))*duration)
        dragging.current=Math.abs(ms-start)<=Math.abs(ms-end)?'start':'end'
        e.currentTarget.setPointerCapture(e.pointerId)
        if(dragging.current==='start')changeStart(ms)
        else changeEnd(ms)
      }}
      onPointerMove={e => {
        if(!dragging.current)return
        const bounds=e.currentTarget.getBoundingClientRect()
        const ms=Math.round(Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width))*duration)
        if(dragging.current==='start')changeStart(ms)
        else changeEnd(ms)
      }}
      onPointerUp={()=>{dragging.current=null}}
      onPointerCancel={()=>{dragging.current=null}}>
      <div className="absolute inset-y-1 rounded bg-primary/70 pointer-events-none"
        style={{left:(start/duration*100)+'%',width:((end-start)/duration*100)+'%'}} />
      <span className="absolute inset-y-0 w-1.5 rounded bg-white shadow pointer-events-none"
        style={{left:'calc('+(start/duration*100)+'% - 3px)'}} />
      <span className="absolute inset-y-0 w-1.5 rounded bg-white shadow pointer-events-none"
        style={{left:'calc('+(end/duration*100)+'% - 3px)'}} />
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">Timing saves without a render. Export applies the saved edit.</p>
  </fieldset>
}

/** Keep the text being typed separate from the clamped numeric time.
 * Committing each keystroke made 1.8 become 1.01 as soon as the user typed 1.
 */
function SecondsField({label,ms,minMs,maxMs,onCommit}: {
  label:string;ms:number;minMs:number;maxMs:number;onCommit:(value:number)=>void
}) {
  const [draft,setDraft]=useState(seconds(ms))
  const [editing,setEditing]=useState(false)
  useEffect(()=>{if(!editing)setDraft(seconds(ms))},[ms,editing])
  const commit=()=>{
    const parsed=Number(draft)
    if(Number.isFinite(parsed)&&draft.trim()!=='')
      onCommit(Math.min(maxMs,Math.max(minMs,Math.round(parsed*1000))))
    else setDraft(seconds(ms))
    setEditing(false)
  }
  return <label className="flex flex-col gap-1 text-xs">{label}
    <input className="h-8 w-full rounded border border-input bg-transparent px-2"
      inputMode="decimal" type="text" value={draft}
      onFocus={()=>setEditing(true)} onChange={e=>setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()
        if(e.key==='Escape'){setDraft(seconds(ms));setEditing(false);e.currentTarget.blur()}}} />
  </label>
}
