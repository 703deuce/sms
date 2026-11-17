'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MsPortableManifest, MsEditProperty } from '@/lib/motion-studio/portable-contract'
type Version = { id:string; revision:number; manifest:MsPortableManifest;
  theme:Record<string,unknown>; overrides:Record<string,unknown> }
const asObj=(v:unknown):Record<string,unknown> =>
  v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : {}
const inputCls='h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm'
export function PortableElementsPanel({projectId,preferredSceneId}:{
 projectId:string;preferredSceneId?:string|null
}) {
  const [version,setVersion]=useState<Version|null>(null)
  const [loading,setLoading]=useState(true)
  const [sceneId,setSceneId]=useState('')
  const [patch,setPatch]=useState<Record<string,Record<string,unknown>>>({})
  const [colors,setColors]=useState<Record<string,string>>({})
  const [status,setStatus]=useState('')
  const [saving,setSaving]=useState(false)
  const [rendering,setRendering]=useState(false)
  const [renderId,setRenderId]=useState('')
  const [renderState,setRenderState]=useState('')
  const [renderUrl,setRenderUrl]=useState<string|null>(null)
  const load=useCallback(async()=>{
    try {
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable',{cache:'no-store'})
      if(!response.ok) throw new Error('Could not load editable project')
      const data=await response.json() as {version:Version|null}
      setVersion(data.version)
      setSceneId(s=>s||data.version?.manifest.scenes[0]?.id||'')
    } catch(err){setStatus(err instanceof Error?err.message:'Could not load editable project')}
    finally {setLoading(false)}
  },[projectId])
  useEffect(()=>{void load()},[load])
  // The editor may be open while the producer is still uploading its source.
  // Refresh until the first immutable portable version arrives (ordinary API, no AI).
  useEffect(()=>{
    if(version)return
    const interval=window.setInterval(()=>void load(),20000)
    return()=>window.clearInterval(interval)
  },[version,load])
  useEffect(()=>{
    if(!renderId)return
    let active=true
    const check=async()=>{
      try{
        const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
          '/portable/render/'+encodeURIComponent(renderId),{cache:'no-store'})
        if(!response.ok)return
        const data=await response.json() as {render?:{status:string;url?:string|null;error?:string}}
        if(!active)return
        setRenderState(data.render?.status||'')
        if(data.render?.url)setRenderUrl(data.render.url)
        if(data.render?.status==='failed')setStatus(data.render.error||'Scene rendering failed')
      }catch{/* Keep the last valid preview while the worker finishes. */}
    }
    void check()
    const interval=window.setInterval(()=>void check(),3000)
    return()=>{active=false;window.clearInterval(interval)}
  },[renderId,projectId])
  const requestRender=async()=>{
    if(!version||!scene||rendering)return
    setRendering(true);setStatus('');setRenderUrl(null)
    try{
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable/render',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({versionId:version.id,sceneId:scene.id,
          idempotencyKey:'preview-'+version.id+'-'+scene.id,patch:{}}),
      })
      const data=await response.json() as {id?:string;error?:string;message?:string}
      if(!response.ok||!data.id)throw new Error(data.message||data.error||'Could not submit render')
      setRenderId(data.id);setRenderState('queued')
    }catch(err){setStatus(err instanceof Error?err.message:'Render request failed')}
    finally{setRendering(false)}
  }
  const scenes=version?.manifest.scenes||[]
  const scene=useMemo(()=>scenes.find(s=>s.id===sceneId)||
    scenes.find(s=>s.id===preferredSceneId)||scenes[0], [scenes,sceneId,preferredSceneId])
  const currentSceneOverrides=asObj(asObj(asObj(version?.overrides).scenes)[scene?.id||''])
  const savedElements=asObj(currentSceneOverrides.elements)
  const setProperty=(elementId:string,prop:string,value:unknown)=>
    setPatch(prev=>({...prev,[elementId]:{...(prev[elementId]||{}),[prop]:value}}))
  const save=async()=>{
    if(!version||!scene||saving)return
    setSaving(true);setStatus('')
    const themePatch=Object.keys(colors).length?{colors}:{}
    const hasPatch=Object.keys(patch).length>0
    try {
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({baseVersionId:version.id,sceneId:scene.id,
          ...(hasPatch?{elements:patch}:{}),themePatch}),
      })
      const data=await response.json() as {version?:Version; affectedSceneIds?:string[]; error?:string;message?:string}
      if(!response.ok||!data.version)throw new Error(data.message||data.error||'Could not save changes')
      setVersion(data.version)
      setPatch({});setColors({})
      setStatus('Saved as project version '+data.version.revision+'. Changes are ready for preview/export rendering.')
    }catch(err){setStatus(err instanceof Error?err.message:'Save failed')}
    finally{setSaving(false)}
  }
  if(loading)return <div className="text-xs text-muted-foreground">Loading editable scene sources…</div>
  if(!version)return null
  const themeColors=asObj(version.theme.colors)
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-3" aria-label="AI-generated editable elements" data-testid="ms-portable-elements">
      <div>
        <h3 className="text-sm font-semibold">Edit original graphics</h3>
        <p className="text-xs text-muted-foreground">Version {version.revision} · Original animation protected</p>
      </div>
      <label className="text-xs font-medium">Scene
        <select className={inputCls} value={scene?.id||''} onChange={e=>{setSceneId(e.target.value);setPatch({})}}>
          {scenes.map(s=><option key={s.id} value={s.id}>{s.id} · {s.engine}</option>)}
        </select>
      </label>
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium">Whole-video theme</h4>
        {Object.entries(themeColors).filter(([,v])=>{
          const actual=typeof v==='string'?v:asObj(v).value
          return typeof actual==='string'&&/^#[0-9a-f]{6}$/i.test(actual)
        }).map(([key,value])=>{const hex=typeof value==='string'?value:String(asObj(value).value);return (
          <label key={key} className="flex items-center gap-2 text-xs">
            <input type="color" aria-label={'Theme '+key} value={colors[key]||hex}
              onChange={e=>setColors(old=>({...old,[key]:e.target.value}))}/>
            <span className="flex-1">{key}</span><code>{colors[key]||hex}</code>
          </label>);})}
      </div>
      {(scene?.manifest.elements||[]).map(element=>{
        const editable=Object.entries(element.properties).filter(([,p])=>
          p.tier==='live_editable'||p.tier==='render_editable')
        if(!editable.length)return null
        return <fieldset key={element.id} className="rounded-lg border border-border p-2">
          <legend className="px-1 text-xs font-semibold">{element.id}</legend>
          <div className="flex flex-col gap-2">
            {editable.map(([key,spec])=>{
              const value=(patch[element.id]||{})[key]??
                asObj(savedElements[element.id])[key]??spec.default??''
              return <label key={key} className="flex flex-col gap-1 text-xs">
                <span>{key} {spec.tier==='render_editable'?'· worker render':''}</span>
                <PropertyControl spec={spec} value={value} onChange={v=>setProperty(element.id,key,v)}/>
              </label>
            })}
          </div>
        </fieldset>
      })}
      {status?<p className="text-xs" role="status">{status}</p>:null}
      <button className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        type="button" onClick={()=>void save()} disabled={saving||(!Object.keys(patch).length&&!Object.keys(colors).length)}>
        {saving?'Saving…':'Save editable changes'}
      </button>
      <button className="h-8 rounded-md border border-input px-3 text-xs font-medium disabled:opacity-50"
        type="button" onClick={()=>void requestRender()} disabled={rendering||saving||!!Object.keys(patch).length||!!Object.keys(colors).length}>
        {rendering?'Submitting…':'Render selected scene without AI'}
      </button>
      {renderId?<p className="text-xs text-muted-foreground" role="status">Render: {renderState||'queued'}</p>:null}
      {renderUrl?<video controls playsInline className="w-full rounded-md" src={renderUrl}
        aria-label="Updated rendered scene"/>:null}
      <p className="text-xs text-muted-foreground">Edits are versioned. Rendering uses compatible workers without AI. Save pending changes before requesting a render.</p>
    </section>
  )
}
function PropertyControl({spec,value,onChange}:{spec:MsEditProperty;value:unknown;onChange:(v:unknown)=>void}) {
  if(spec.type==='color')return <input aria-label="Color" type="color" value={typeof value==='string'?value:'#ffffff'}
    onChange={e=>onChange(e.target.value)}/>
  if(spec.type==='boolean')return <input aria-label="Enabled" type="checkbox" checked={Boolean(value)}
    onChange={e=>onChange(e.target.checked)}/>
  if(spec.type==='enum'||((spec.type==='font')&&((spec.choices||spec.values)?.length))) {
    const choices=spec.choices||spec.values||[]
    return <select className={inputCls} value={String(value)} onChange={e=>onChange(e.target.value)}>
      {choices.map(c=><option key={c} value={c}>{c}</option>)}
    </select>
  }
  if(spec.type==='number')return <input className={inputCls} type="number" min={spec.min} max={spec.max}
    value={typeof value==='number'?value:0} onChange={e=>onChange(Number(e.target.value))}/>
  if(spec.type==='point'){
    const p=asObj(value)
    return <div className="grid grid-cols-2 gap-2">
      {(['x','y'] as const).map(axis=><input key={axis} aria-label={'Focal '+axis}
        type="number" className={inputCls} min={0} max={1} step={0.01}
        value={typeof p[axis]==='number'?String(p[axis]):'0.5'}
        onChange={e=>onChange({...p,[axis]:Number(e.target.value)})}/>)}
    </div>
  }
  return <input className={inputCls} type="text" value={String(value)}
    maxLength={spec.maxChars||2048} onChange={e=>onChange(e.target.value)}/>
}
