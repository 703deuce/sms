'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MsPortableManifest, MsPortableScene } from '@/lib/motion-studio/portable-contract'
import type { MotionNode } from '@/lib/motion-studio/scene-graph'

type Patch = Record<string, Record<string, unknown>>
const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
type Box = { x: number; y: number; w: number; h: number }

/** Layers of a scene: the producer's motion tree when present, otherwise its flat editable elements. */
export function sceneLayers(scene: MsPortableScene): { id: string; name: string; kind: string; depth: number }[] {
  const tree = scene.manifest.motionTree
  if (!tree) return scene.manifest.elements.filter(e => e.id !== 'sceneSettings')
    .map(e => ({ id: e.id, name: e.id, kind: e.kind, depth: 0 }))
  const kids = new Map<string, MotionNode[]>()
  for (const n of tree.nodes) if (n.id !== tree.rootId) {
    const p = n.parentId || tree.rootId
    kids.set(p, [...(kids.get(p) || []), n])
  }
  const out: { id: string; name: string; kind: string; depth: number }[] = []
  const walk = (id: string, depth: number) => {
    for (const n of kids.get(id) || []) { out.push({ id: n.id, name: n.name, kind: n.kind, depth }); walk(n.id, depth + 1) }
  }
  walk(tree.rootId, 0)
  return out
}
const val = (patch: Patch, saved: Record<string, unknown>, id: string, key: string, dflt: unknown) =>
  (patch[id] || {})[key] ?? asObj(saved[id])[key] ?? dflt

/** Simple layer list: click to select, show/hide, lock, rename (double-click). */
export function PortableLayerList({ scene, selected, onSelect, savedElements, patch, onChange }: {
  scene: MsPortableScene; selected: string; onSelect: (id: string) => void
  savedElements: Record<string, unknown>; patch: Patch
  onChange: (elementId: string, prop: string, value: unknown) => void
}) {
  const layers = useMemo(() => sceneLayers(scene), [scene])
  const [renaming, setRenaming] = useState('')
  const props = (id: string) => scene.manifest.elements.find(e => e.id === id)?.properties || {}
  return <div className="flex flex-col gap-1" aria-label="Layers" data-testid="ms-layer-list">
    <div className="flex items-center justify-between">
      <h4 className="text-xs font-medium">Layers</h4>
      {selected ? <button type="button" className="text-xs text-muted-foreground" onClick={() => onSelect('')}>Scene settings</button> : null}
    </div>
    <ul className="max-h-64 overflow-auto rounded-md border border-border text-xs" role="listbox" aria-label="Scene layers">
      {layers.map(l => {
        const p = props(l.id)
        const name = String(val(patch, savedElements, l.id, 'name', p.name?.default ?? l.name))
        const visible = val(patch, savedElements, l.id, 'visible', p.visible?.default ?? true) !== false
        const locked = Boolean(val(patch, savedElements, l.id, 'locked', false))
        return <li key={l.id} role="option" aria-selected={selected === l.id}
          className={'flex items-center gap-1 px-2 py-1 ' + (selected === l.id ? 'bg-primary/10' : 'hover:bg-muted')}
          style={{ paddingLeft: 8 + l.depth * 14 }} onClick={() => onSelect(l.id)}>
          {p.visible ? <button type="button" aria-label={visible ? 'Hide layer' : 'Show layer'} title={visible ? 'Hide' : 'Show'}
            className="w-5 shrink-0" onClick={e => { e.stopPropagation(); onChange(l.id, 'visible', !visible) }}>{visible ? '👁' : '–'}</button> : <span className="w-5" />}
          {p.locked ? <button type="button" aria-label={locked ? 'Unlock layer' : 'Lock layer'} title={locked ? 'Unlock' : 'Lock'}
            className="w-5 shrink-0" onClick={e => { e.stopPropagation(); onChange(l.id, 'locked', !locked) }}>{locked ? '🔒' : '🔓'}</button> : <span className="w-5" />}
          {renaming === l.id && p.name ? <input autoFocus className="h-6 flex-1 rounded border border-input bg-transparent px-1"
            defaultValue={name} maxLength={80} onClick={e => e.stopPropagation()}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== name) onChange(l.id, 'name', v); setRenaming('') }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming('') }} />
            : <span className={'flex-1 truncate ' + (visible ? '' : 'text-muted-foreground line-through')}
              onDoubleClick={() => p.name && setRenaming(l.id)}>{name}</span>}
          <span className="text-[10px] text-muted-foreground">{l.kind}</span>
        </li>
      })}
    </ul>
    <p className="text-[11px] text-muted-foreground">Click a layer (or the picture) to edit it. Double-click to rename.</p>
  </div>
}

/** Still-frame picker: the newest rendered video at this scene, with clickable layer boxes. */
export function PortableScenePicker({ scene, manifest, videoUrl, selected, onSelect, savedElements, patch }: {
  scene: MsPortableScene; manifest: MsPortableManifest; videoUrl: string | null
  selected: string; onSelect: (id: string) => void; savedElements: Record<string, unknown>; patch: Patch
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [scale, setScale] = useState(0)
  const [time, setTime] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  useEffect(() => setPlaybackFailed(false), [videoUrl])
  const tree = scene.manifest.motionTree
  const root = tree?.nodes.find(n => n.id === tree.rootId)
  const width = Number(root?.properties.width?.value) || 1920
  const height = Number(root?.properties.height?.value) || 1080
  const placements = asObj(manifest.timeline).nativeScenePlacements
  const startSec = Array.isArray(placements)
    ? Number(asObj(asObj(placements.find(p => asObj(p).sceneId === scene.id)).timeline).startSec) || 0 : 0
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const seek = () => { try { v.currentTime = startSec + 0.9 * Math.max(0.1, (tree?.durationMs || 2000) / 1000) } catch { /* not seekable yet */ } }
    v.addEventListener('loadedmetadata', seek)
    const fit = () => setScale(v.clientWidth / width)
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(v)
    return () => { v.removeEventListener('loadedmetadata', seek); ro?.disconnect() }
  }, [videoUrl, startSec, width, tree?.durationMs])
  const boxes = useMemo(() => {
    const byId = new Map(scene.manifest.elements.map(e => [e.id, e]))
    const abs = (id: string, n = 0): Box | null => {
      const el = byId.get(id); const layout = asObj((el as unknown as { layout?: unknown })?.layout)
      const b = asObj(layout.fitBox) as unknown as Box
      if (!el || typeof b.x !== 'number' || n > 64) return null
      const parent = typeof layout.parentId === 'string' ? abs(layout.parentId, n + 1) : null
      const ox = Number(val(patch, savedElements, id, 'x', 0)) || 0, oy = Number(val(patch, savedElements, id, 'y', 0)) || 0
      return { x: b.x + ox + (parent?.x || 0), y: b.y + oy + (parent?.y || 0), w: b.w, h: b.h }
    }
    // Smallest boxes last so they sit on top and stay clickable.
    return sceneLayers(scene).map(l => ({ id: l.id, box: abs(l.id) }))
      .filter((x): x is { id: string; box: Box } => Boolean(x.box))
      .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)
  }, [scene, patch, savedElements])
  return <section className="flex flex-col gap-1" aria-label="Scene layer picker">
    <p className="text-xs font-medium">Scene preview</p>
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-black" style={{ aspectRatio: `${width}/${height}` }}>
      {videoUrl && !playbackFailed ? <video ref={ref} src={videoUrl} muted playsInline preload="metadata"
        onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}
        onError={()=>setPlaybackFailed(true)}
        className="absolute inset-0 size-full object-contain" /> : null}
      {(!videoUrl || playbackFailed) ? <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-white/80">
        {playbackFailed ? 'Base video is not playable in this browser. Original layers are still editable.' : 'Base video is not available yet. Original layers are still editable.'}
      </div> : null}
      {scale > 0 ? boxes.map(({ id, box }) => <button key={id} type="button" aria-label={'Select layer ' + id}
        onClick={() => onSelect(id)}
        className={'absolute rounded-sm border ' + (selected === id ? 'border-primary bg-primary/10' : 'border-transparent hover:border-white/60')}
        style={{ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale }} />) : null}
    </div>
    {videoUrl && !playbackFailed ? <div className="flex items-center gap-2">
      <button className="rounded border border-input px-2 py-1 text-xs" type="button"
        onClick={()=>{const v=ref.current;if(!v)return;if(v.paused)void v.play().catch(()=>setPlaybackFailed(true));else v.pause()}}>Play / pause</button>
      <input type="range" aria-label="Scrub scene preview" className="min-w-0 flex-1"
        min={startSec} max={startSec + Math.max(0.1,(tree?.durationMs || 2000)/1000)} step={0.01}
        value={Math.max(startSec,Math.min(time||startSec,startSec+Math.max(0.1,(tree?.durationMs || 2000)/1000)))}
        onChange={e=>{const v=ref.current;if(v)v.currentTime=Number(e.target.value);setTime(Number(e.target.value))}} />
      <span className="text-xs tabular-nums">{Math.max(0,time-startSec).toFixed(2)}s</span>
    </div> : null}
    <p className="text-[11px] text-muted-foreground">Browser scrubbing does not encode video. Exact effects and motion still require the original scene host or a final render.</p>
  </section>
}
