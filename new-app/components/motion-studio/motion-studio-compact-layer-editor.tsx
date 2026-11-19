'use client'

import {useCallback,useEffect,useMemo,useState} from 'react'
import type {MsPortableManifest,MsEditProperty} from '@/lib/motion-studio/portable-contract'
import {normalizeUniversalTimeline} from '@/lib/motion-studio/universal-timeline'

type Version={id:string;revision:number;manifest:MsPortableManifest;
  theme:Record<string,unknown>;overrides:Record<string,unknown>}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)
  ?v as Record<string,unknown>:{}

function Control({spec,value,onChange}:{spec:MsEditProperty;value:unknown;onChange:(v:unknown)=>void}){
  const cls='h-8 min-w-0 w-full rounded border border-border bg-background px-2 text-xs'
  if(spec.type==='boolean')return <input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)}/>
  if(spec.type==='number')return <input className={cls} type="number" min={spec.min} max={spec.max}
    value={typeof value==='number'?value:''} onChange={e=>{
      if(e.target.value!==''&&Number.isFinite(Number(e.target.value)))onChange(Number(e.target.value))
    }}/>
  if(spec.type==='point'){
    const point=obj(value)
    return <div className="flex gap-2">
      {(['x','y'] as const).map(k=><label key={k} className="flex min-w-0 flex-1 items-center gap-1">
        <span>{k}</span><input className={cls} type="number" min={0} max={1} step={0.01}
          value={typeof point[k]==='number'?point[k]:0.5}
          onChange={e=>onChange({...point,[k]:Math.max(0,Math.min(1,Number(e.target.value)||0))})}/>
      </label>)}
    </div>
  }
  const choices=spec.choices||spec.values||spec.enum
  if(choices?.length)return <select className={cls} value={String(value??'')} onChange={e=>onChange(e.target.value)}>
    {choices.map(choice=><option key={choice} value={choice}>{choice}</option>)}
  </select>
  if(spec.type==='color')return <input aria-label="Color" type="color"
    value={typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)?value:'#ffffff'}
    onChange={e=>onChange(e.target.value)}/>
  if(spec.type==='text')return <textarea className={cls+' h-16 py-2'} rows={2}
    maxLength={spec.maxChars} value={String(value??'')} onChange={e=>onChange(e.target.value)}/>
  return <input className={cls} value={String(value??'')} onChange={e=>onChange(e.target.value)}/>
}

/** Native producer layers and properties, inside Compact's existing lane slot.
 * PATCH creates a new immutable portable revision. ClipEditsV2 continues to
 * own the canvas/timeline without copying executable scene JS into clip edits.
 */
export function MotionStudioCompactLayerEditor({projectId,outputMs,onSeek}:{
  projectId:string;outputMs:number;onSeek:(ms:number)=>void
}){
  const [version,setVersion]=useState<Version|null>(null)
  const [selected,setSelected]=useState<{sceneId:string;elementId:string}|null>(null)
  const [patch,setPatch]=useState<Record<string,unknown>>({})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const load=useCallback(async()=>{
    const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable',{cache:'no-store'})
    if(!response.ok)throw new Error('Editable layer data is unavailable')
    const data=await response.json() as {version?:Version|null}
    setVersion(data.version||null)
  },[projectId])
  useEffect(()=>{
    let active=true
    void load().catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load layers')})
    return()=>{active=false}
  },[load])
  const timeline=useMemo(()=>version?normalizeUniversalTimeline(version.manifest):null,[version])
  const layers=timeline?.sceneLayers||[]
  const current=selected??(layers.length?{sceneId:layers[0]!.sceneId,elementId:layers[0]!.elementId}:null)
  const scene=version?.manifest.scenes.find(s=>s.id===current?.sceneId)
  const element=scene?.manifest.elements.find(e=>e.id===current?.elementId)
  const saved=obj(obj(obj(version?.overrides).scenes)[current?.sceneId||''])
  const overrides=obj(obj(saved.elements)[current?.elementId||''])
  const editable=Object.entries(element?.properties||{}).filter(([,spec])=>
    spec.tier==='live_editable'||spec.tier==='render_editable')
  const save=async()=>{
    if(!version||!current||!Object.keys(patch).length)return
    setSaving(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({baseVersionId:version.id,sceneId:current.sceneId,
          elements:{[current.elementId]:patch}}),
      })
      const data=await response.json() as {version?:Version;requiresRender?:boolean;error?:string}
      if(!response.ok||!data.version)throw new Error(data.error||'Could not save scene layer')
      setVersion(data.version)
      setPatch({})
      setNotice(data.requiresRender?'Saved. This property needs a scene render to update the picture.':
        'Saved to the editable scene project.')
    }catch(e){setError(e instanceof Error?e.message:'Save failed')}
    finally{setSaving(false)}
  }
  if(!version)return error?<p role="status" className="text-xs text-destructive">{error}</p>:
    <p className="text-xs text-muted-foreground">Loading original editable scene layers…</p>
  return <section aria-label="Editable Motion Studio layers" data-testid="ms-compact-live-layers"
    className="space-y-2 rounded-md border border-border p-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold">Original editable layers</span>
      <span className="text-[11px] text-muted-foreground">Revision {version.revision}</span>
    </div>
    {!layers.length?<p className="text-xs text-muted-foreground">No separate graphic layers are declared in this live timeline.</p>:null}
    <div className="relative h-8 rounded bg-muted" aria-label="Motion graphics lane">
      {layers.map(layer=>{
        const total=Math.max(1,timeline?.durationMs||1)
        const left=100*layer.startMs/total
        const width=Math.max(1,100*(layer.endMs-layer.startMs)/total)
        const active=layer.sceneId===current?.sceneId&&layer.elementId===current?.elementId
        return <button type="button" key={layer.id} title={layer.label} aria-pressed={active}
          className={'absolute top-1 h-6 overflow-hidden rounded border px-1 text-left text-[10px] '+(
            active?'border-primary bg-primary/25':'border-border bg-background/70')}
          style={{left:Math.max(0,left)+'%',width:Math.min(width,100-left)+'%'}}
          onClick={()=>{
            setSelected({sceneId:layer.sceneId,elementId:layer.elementId});setPatch({})
            onSeek(layer.startMs);setNotice('')
          }}>{layer.label}</button>
      })}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-primary"
        style={{left:100*Math.max(0,Math.min(outputMs,timeline?.durationMs||1))/Math.max(1,timeline?.durationMs||1)+'%'}}/>
    </div>
    {element?<div className="space-y-2">
      <p className="text-xs font-medium">{element.id} · {scene?.id}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {editable.map(([key,spec])=><label key={key} className="flex min-w-0 flex-col gap-1 text-[11px]">
          <span>{key}{spec.tier==='render_editable'?' · needs render':''}</span>
          <Control spec={spec} value={patch[key]??overrides[key]??spec.default??''}
            onChange={v=>{setPatch(old=>({...old,[key]:v}));setNotice('')}}/>
        </label>)}
      </div>
      {!editable.length?<p className="text-xs text-muted-foreground">This layer has no directly editable properties.</p>:null}
      <div className="flex items-center gap-2">
        <button type="button" className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          disabled={!Object.keys(patch).length||saving} onClick={()=>void save()}>
          {saving?'Saving…':'Save layer'}
        </button>
        <button type="button" className="rounded border px-2 py-1.5 text-xs" disabled={saving}
          onClick={()=>{setPatch({});setNotice('')}}>Reset</button>
      </div>
    </div>:null}
    {error?<p role="alert" className="text-xs text-destructive">{error}</p>:null}
    {notice?<p role="status" className="text-xs text-muted-foreground">{notice}</p>:null}
    <p className="text-[11px] text-muted-foreground">
      The Compact canvas shows the approved original MP4. Editable scene changes are saved to
      the native live project; the original MP4 is not silently overwritten.
    </p>
  </section>
}
