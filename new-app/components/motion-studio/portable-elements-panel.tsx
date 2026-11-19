'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {PollHttpError,startPolling} from '@/lib/motion-studio/poll'
import type { MsPortableManifest, MsEditProperty } from '@/lib/motion-studio/portable-contract'
import { PortableLiveFilmPlayer } from './portable-live-film-player'
import { PortableLayerList, PortableScenePicker, sceneLayers } from './portable-layer-list'
import { PortableLayerTiming } from './portable-layer-timing'
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
  const [projectRenderId,setProjectRenderId]=useState('')
  const [projectRenderState,setProjectRenderState]=useState('')
  const [projectRendering,setProjectRendering]=useState(false)
  const [history,setHistory]=useState<{id:string;revision:number;createdAt:string}[]>([])
  const [restoreId,setRestoreId]=useState('')
  const [selectedLayer,setSelectedLayer]=useState('')
  const [masterUrl,setMasterUrl]=useState<string|null>(null)
  const savingRef=useRef(false)
  const revisionRef=useRef(0)
  const load=useCallback(async()=>{
    try {
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable',{cache:'no-store'})
      if(!response.ok) throw new Error('Could not load editable project')
      const data=await response.json() as {version:Version|null;history?:{id:string;revision:number;createdAt:string}[]}
      // An older GET may finish after a successful save. Never roll the editor back.
      if(data.version && data.version.revision >= revisionRef.current) {
        revisionRef.current=data.version.revision
        setVersion(data.version)
      }
      setHistory(data.history||[])
      setSceneId(s=>s||data.version?.manifest.scenes[0]?.id||'')
    } catch(err){setStatus(err instanceof Error?err.message:'Could not load editable project')}
    finally {setLoading(false)}
  },[projectId])
  useEffect(()=>{void load()},[load])
  // Still-frame layer picker: the newest committed master (refreshed after every no-AI render).
  useEffect(()=>{
    let active=true
    fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable/preview',{cache:'no-store'})
      .then(r=>r.ok?r.json():null).then((d:{url?:string|null}|null)=>{
        if(active)setMasterUrl(d?.url??null)
      }).catch(()=>undefined)
    return()=>{active=false}
  },[projectId,version?.id])
  // The editor may be open while the producer is still uploading its source.
  // Refresh until the first immutable portable version arrives (ordinary API, no AI).
  useEffect(()=>{
    if(version)return
    return startPolling(async()=>{await load()},{intervalMs:20000,maxIntervalMs:120000})
  },[version,load])
  useEffect(()=>{
    if(!renderId)return
    let active=true
    // Sequential, >= 5s, stops when the render finished or failed.
    const stop=startPolling(async()=>{
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
        '/portable/render/'+encodeURIComponent(renderId),{cache:'no-store'})
      if(!response.ok)throw new PollHttpError(response.status)
      const data=await response.json() as {render?:{status:string;url?:string|null;error?:string}}
      if(!active)return false
      setRenderState(data.render?.status||'')
      if(data.render?.url)setRenderUrl(data.render.url)
      if(data.render?.status==='failed')setStatus(data.render.error||'Scene rendering failed')
      return !['complete','completed','ready','failed','cancelled'].includes(data.render?.status||'')
    },{intervalMs:5000,immediate:true})
    return()=>{active=false;stop()}
  },[renderId,projectId])
  useEffect(()=>{
    if(!projectRenderId)return
    let active=true
    const stop=startPolling(async()=>{
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
        '/portable/render-project/'+encodeURIComponent(projectRenderId),{cache:'no-store'})
      if(!response.ok)throw new PollHttpError(response.status)
      const result=await response.json() as {job?:{status:string;error?:string|null;publishedVersionId?:string|null}}
      if(!active||!result.job)return active
      setProjectRenderState(result.job.status)
      if(result.job.status==='failed')setStatus(result.job.error||'Full video rendering failed')
      if(result.job.status==='complete'){
        setStatus('The full edited video has been rendered and added to your project.')
        void load()
      }
      return !['complete','failed','cancelled'].includes(result.job.status)
    },{intervalMs:5000,immediate:true})
    return()=>{active=false;stop()}
  },[projectRenderId,projectId,load])

  const requestProjectRender=async()=>{
    if(!version||projectRendering)return
    setProjectRendering(true);setStatus('')
    try{
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
        '/portable/render-project',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({versionId:version.id,
            idempotencyKey:'final-'+version.id}),
        })
      const data=await response.json() as {id?:string;status?:string;error?:string;message?:string}
      if(!response.ok||!data.id)throw new Error(data.message||data.error||'Could not submit the full render')
      setProjectRenderId(data.id);setProjectRenderState(data.status||'queued')
    }catch(e){setStatus(e instanceof Error?e.message:'Could not submit full render')}
    finally{setProjectRendering(false)}
  }

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
  const restore=async()=>{
    if(!version||!restoreId||restoreId===version.id||saving)return
    setSaving(true);setStatus('')
    try{
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({baseVersionId:version.id,restoreVersionId:restoreId}),
      })
      const data=await response.json() as {version?:Version;error?:string;message?:string}
      if(!response.ok||!data.version)throw new Error(data.message||data.error||'Restore failed')
      revisionRef.current=data.version.revision
      setVersion(data.version);setPatch({});setColors({});setRenderId('');setRenderUrl(null)
      setRestoreId('');setStatus('Restored earlier settings as version '+data.version.revision)
      void load()
    }catch(err){setStatus(err instanceof Error?err.message:'Restore failed')}
    finally{setSaving(false)}
  }
    const scenes=version?.manifest.scenes||[]
  const scene=useMemo(()=>scenes.find(s=>s.id===sceneId)||
    scenes.find(s=>s.id===preferredSceneId)||scenes[0], [scenes,sceneId,preferredSceneId])
  const currentSceneOverrides=asObj(asObj(asObj(version?.overrides).scenes)[scene?.id||''])
  const savedElements=asObj(currentSceneOverrides.elements)
  const setProperty=(elementId:string,prop:string,value:unknown)=>
    setPatch(prev=>({...prev,[elementId]:{...(prev[elementId]||{}),[prop]:value}}))
  const save=async()=>{
    if(!version||!scene||savingRef.current)return
    savingRef.current=true;setSaving(true);setStatus('')
    const themePatch=Object.keys(colors).length?{colors}:{}
    const hasPatch=Object.keys(patch).length>0
    const controller=new AbortController()
    let committedHead:Version|null=null
    const timer=window.setTimeout(()=>controller.abort(),12000)
    try {
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({baseVersionId:version.id,sceneId:scene.id,
          ...(hasPatch?{elements:patch}:{}),themePatch}),
        signal:controller.signal,
      })
      const data=await response.json() as {version?:Version; affectedSceneIds?:string[]; error?:string;message?:string}
      if(!response.ok||!data.version)throw new Error(data.message||data.error||'Could not save changes')
      committedHead=data.version
      // Read back the immutable version from the database, rather than trusting
      // a 200 response that might contain a transient or stale payload.
      const readback=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
        '/portable?versionId='+encodeURIComponent(data.version.id),
        {cache:'no-store',signal:controller.signal})
      if(!readback.ok)throw new Error('Saved version could not be read back. Keep your edits and retry.')
      const persisted=await readback.json() as {version:Version|null}
      if(!persisted.version||persisted.version.id!==data.version.id)
        throw new Error('Saved version was not found on reload. Your local edits were kept.')
      data.version=persisted.version
      // Confirm the server committed exactly the layer values we sent before
      // claiming success or discarding local edits. No rendering occurs here.
      const savedScenes=asObj(asObj(data.version.overrides).scenes)
      const committed=asObj(asObj(savedScenes[scene.id]).elements)
      for(const [id,values] of Object.entries(patch)){
        const actual=asObj(committed[id])
        for(const [key,value] of Object.entries(values)){
          if(JSON.stringify(actual[key])!==JSON.stringify(value))
            throw new Error('Save verification failed for '+id+'.'+key+'. Your edits are still here; retry saving.')
        }
      }
      revisionRef.current=data.version.revision
      setVersion(data.version)
      setPatch({});setColors({});setRenderId('');setRenderUrl(null)
      setHistory(old=>[{id:data.version!.id,revision:data.version!.revision,createdAt:new Date().toISOString()},...old])
      setStatus('Version '+data.version.revision+' saved and verified. No render started.')
    }catch(err){
      // A write may succeed even when its readback times out. Retain the
      // draft but advance the base so the next Save does not conflict.
      if(committedHead){
        revisionRef.current=Math.max(revisionRef.current,committedHead.revision)
        setVersion(committedHead)
      }
      setStatus(controller.signal.aborted
        ? 'Save timed out before confirmation. Changes are still in the editor; check the project version before retrying.'
        : err instanceof Error?err.message:'Save failed')
    }
    finally{window.clearTimeout(timer);savingRef.current=false;setSaving(false)}
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
      {history.length>1?<div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="ms-restore-version">Previous versions</label>
        <select id="ms-restore-version" className={inputCls} value={restoreId}
          onChange={e=>setRestoreId(e.target.value)}>
          <option value="">Choose a version to restore</option>
          {history.filter(h=>h.id!==version.id).map(h=><option key={h.id} value={h.id}>
            Version {h.revision}
          </option>)}
        </select>
        <button type="button" className="h-8 rounded-md border border-input text-xs"
          disabled={!restoreId||saving||Object.keys(patch).length>0||Object.keys(colors).length>0}
          onClick={()=>void restore()}>Restore as new version</button>
      </div>:null}
      <label className="text-xs font-medium">Scene
        <select className={inputCls} value={scene?.id||''} onChange={e=>{setSceneId(e.target.value);setPatch({})}}>
          {scenes.map(s=><option key={s.id} value={s.id}>{s.id} · {s.engine}</option>)}
        </select>
      </label>
      {scene && (scene.manifest.livePreview?.capability==='render_only'
        ? <PortableScenePicker scene={scene} manifest={version.manifest} videoUrl={masterUrl}
            selected={selectedLayer} onSelect={setSelectedLayer} savedElements={savedElements} patch={patch} onChange={setProperty}/>
        : <PortableLiveFilmPlayer projectId={projectId} versionId={version.id} previewVideoUrl={masterUrl}
            manifest={version.manifest} theme={{...version.theme,
              colors:{...asObj(version.theme.colors),...colors}}}
            overrides={version.overrides} scenePatch={patch} onSceneChange={setSceneId}
            selectedLayer={selectedLayer} onSelectLayer={setSelectedLayer}
            onLayerChange={(id,key,value)=>setProperty(id,key,value)}/>)}
      {scene && sceneLayers(scene).length>0 ? <PortableLayerList scene={scene} selected={selectedLayer}
        onSelect={setSelectedLayer} savedElements={savedElements} patch={patch} onChange={setProperty}/> : null}
      {scene && selectedLayer ? <PortableLayerTiming scene={scene} layerId={selectedLayer}
        savedElements={savedElements} patch={patch} onChange={setProperty} /> : null}
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
      {(scene?.manifest.elements||[]).filter(element=>!scene?.manifest.motionTree||element.id===selectedLayer||
        (element.id==='sceneSettings'&&!selectedLayer)).map(element=>{
        const layerProps=new Set(scene?.manifest.motionTree?['name','locked','visible']:[])
        const locked=Boolean((patch[element.id]||{}).locked??asObj(savedElements[element.id]).locked)
        const editable=Object.entries(element.properties).filter(([key,p])=>!layerProps.has(key)&&
          (p.tier==='live_editable'||p.tier==='render_editable'))
        if(!editable.length)return null
        return <fieldset key={element.id} className="rounded-lg border border-border p-2">
          <legend className="px-1 text-xs font-semibold">{element.id}</legend>
          <div className="flex flex-col gap-2">
            {editable.map(([key,spec])=>{
              const value=(patch[element.id]||{})[key]??
                asObj(savedElements[element.id])[key]??spec.default??''
              return <label key={key} className="flex flex-col gap-1 text-xs">
                <span>{key} {spec.tier==='render_editable'?'· worker render':''}</span>
                <PropertyControl spec={spec} value={value} disabled={locked}
                  onChange={v=>setProperty(element.id,key,v)}/>
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
      <button type="button" className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
        disabled={projectRendering||saving||!!Object.keys(patch).length||!!Object.keys(colors).length||
          (projectRenderState==='queued'||projectRenderState==='reserved'||projectRenderState==='running')}
        onClick={()=>void requestProjectRender()}>
        {projectRendering?'Submitting…':'Render complete edited video without AI'}
      </button>
      {projectRenderId?<p role="status" className="text-xs text-muted-foreground">
        Full video render: {projectRenderState||'queued'}
      </p>:null}
      <p className="text-xs text-muted-foreground">Edits are versioned. Rendering uses compatible workers without AI. Save pending changes before requesting a render.</p>
    </section>
  )
}
function PropertyControl({spec,value,onChange,disabled=false}:{spec:MsEditProperty;value:unknown;onChange:(v:unknown)=>void;disabled?:boolean}) {
  if(disabled)return <span className="text-xs text-muted-foreground">{typeof value==='object'?'…':String(value)} (locked)</span>
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
  if(spec.type==='number')return <EditableNumber value={typeof value==='number'?value:0}
    min={spec.min} max={spec.max} onChange={onChange}/>
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

/** A numeric draft can temporarily be '-' or '-6' while typing -60.
 * Clamp only when the user commits; do not erase partial input per keystroke.
 */
function EditableNumber({value,min,max,onChange}:{
  value:number;min?:number;max?:number;onChange:(v:number)=>void
}){
  const [draft,setDraft]=useState(String(value))
  const [editing,setEditing]=useState(false)
  useEffect(()=>{if(!editing)setDraft(String(value))},[value,editing])
  const commit=()=>{
    const parsed=Number(draft)
    if(draft.trim()!==''&&Number.isFinite(parsed))
      onChange(Math.max(min??-Infinity,Math.min(max??Infinity,parsed)))
    else setDraft(String(value))
    setEditing(false)
  }
  return <input className={inputCls} type="text" inputMode="decimal" value={draft}
    onFocus={()=>setEditing(true)} onChange={e=>setDraft(e.target.value)}
    onBlur={commit} onKeyDown={e=>{
      if(e.key==='Enter')e.currentTarget.blur()
      if(e.key==='Escape'){setDraft(String(value));setEditing(false);e.currentTarget.blur()}
    }}/>
}
