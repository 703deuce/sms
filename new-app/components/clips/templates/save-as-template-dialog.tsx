'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Inspection = {
  clipId: string
  editsSaveVersion: number
  durationMs: number
  aspect: string
  replaceable: Array<{ key:string;label:string;media:'video'|'image'|'either';minDurationMs:number }>
  textFields: Array<{ id:string;label:string;text:string;maxChars:number }>
  decorativeDependencies: Array<{ key:string;label:string;kind:string }>
  musicPresent: boolean
  warnings: string[]
}
type Choice = 'slot'|'keep'
type ExistingTemplate = { id:string;title:string;description:string;currentRevision:number }
type Props = { open:boolean;clipId:string;defaultTitle:string;onClose:()=>void }

function decorativeFor(inspection:Inspection,key:string){
  if(key==='main') return inspection.decorativeDependencies.find(d=>d.key.startsWith('main:'))
  if(key.startsWith('broll:')) return inspection.decorativeDependencies.find(d=>d.key.startsWith(key+':'))
  return inspection.decorativeDependencies.find(d=>d.key===key)
}
function fmt(ms:number){return ms<1000?ms+' ms':(ms/1000).toFixed(ms%1000?1:0)+' s'}

export function SaveAsTemplateDialog({open,clipId,defaultTitle,onClose}:Props){
  const [inspection,setInspection]=useState<Inspection|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [title,setTitle]=useState(defaultTitle)
  const [description,setDescription]=useState('')
  const [choices,setChoices]=useState<Record<string,Choice>>({})
  const [editableText,setEditableText]=useState<Record<string,boolean>>({})
  const [extraDecorative,setExtraDecorative]=useState<Record<string,boolean>>({})
  const [musicPolicy,setMusicPolicy]=useState<''|'keep'|'replace'|'mute'>('')
  const [existingTemplates,setExistingTemplates]=useState<ExistingTemplate[]>([])
  const [versionTarget,setVersionTarget]=useState('')
  const [previewStart,setPreviewStart]=useState(0)
  const [previewEnd,setPreviewEnd]=useState(15000)

  useEffect(()=>{
    if(!open)return
    let live=true
    setLoading(true);setError(null);setInspection(null);setChoices({});setEditableText({});setExtraDecorative({})
    setMusicPolicy('');setTitle(defaultTitle);setDescription('');setVersionTarget('')
    fetch('/api/clips/user-templates?page=1',{cache:'no-store'})
      .then(async r=>{const body=await r.json() as {data?:{items:ExistingTemplate[]}}
        if(live&&r.ok&&body.data)setExistingTemplates(body.data.items)})
      .catch(()=>{if(live)setExistingTemplates([])})
    fetch('/api/clips/user-templates/inspect?clipId='+encodeURIComponent(clipId),{cache:'no-store'})
      .then(async r=>{const body=await r.json() as {data?:Inspection;error?:string}
        if(!r.ok||!body.data)throw new Error(body.error??'Could not inspect this edit')
        if(!live)return
        setInspection(body.data);setPreviewStart(0);setPreviewEnd(Math.min(body.data.durationMs,15000))
        setMusicPolicy(body.data.musicPresent?'':'mute')
      })
      .catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not inspect this edit')})
      .finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[open,clipId,defaultTitle])

  const matchedDecorative=useMemo(()=>{
    if(!inspection)return new Set<string>()
    const out=new Set<string>()
    for(const item of inspection.replaceable){const d=decorativeFor(inspection,item.key);if(d)out.add(d.key)}
    return out
  },[inspection])
  const nonReplaceable=inspection?.decorativeDependencies.filter(d=>
    !matchedDecorative.has(d.key)&&!d.key.startsWith('music:'))??[]
  const slotItems=inspection?.replaceable.filter(x=>choices[x.key]==='slot')??[]
  const complete=Boolean(inspection&&inspection.replaceable.every(x=>Boolean(choices[x.key]))&&
    (!inspection.musicPresent||musicPolicy))

  const save=async()=>{
    if(!inspection||!complete)return
    const keepKeys=inspection.replaceable.flatMap(item=>{
      if(choices[item.key]!=='keep')return[]
      const dep=decorativeFor(inspection,item.key)
      return dep?[dep.key]:[]
    })
    const explicit=nonReplaceable.filter(d=>extraDecorative[d.key]).map(d=>d.key)
    const musicKeep=musicPolicy==='keep'
      ? inspection.decorativeDependencies.filter(d=>d.key.startsWith('music:')).map(d=>d.key):[]
    setSaving(true);setError(null)
    try{
      const endpoint=versionTarget
        ? '/api/clips/user-templates/'+encodeURIComponent(versionTarget)+'/revisions'
        : '/api/clips/user-templates'
      const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          clipId,title,description,
          replaceableItemKeys:inspection.replaceable.filter(x=>choices[x.key]==='slot').map(x=>x.key),
          editableTextIds:inspection.textFields.filter(x=>editableText[x.id]).map(x=>x.id),
          decorativeAssetKeys:[...new Set([...keepKeys,...explicit,...musicKeep])],
          musicPolicy:inspection.musicPresent?musicPolicy:'mute',
          previewRange:{startMs:previewStart,endMs:previewEnd},
        })})
      const body=await response.json() as {data?:{id:string};error?:string}
      if(!response.ok||!body.data)throw new Error(body.error??'Could not save template')
      toast.success(versionTarget?'Saved as a new immutable template revision':'Saved to My templates')
      onClose()
    }catch(e){setError(e instanceof Error?e.message:'Could not save template')}
    finally{setSaving(false)}
  }

  return <Dialog open={open} onOpenChange={next=>{if(!next&&!saving)onClose()}}>
    <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto" data-testid="save-as-template-dialog">
      <DialogHeader>
        <DialogTitle>Save as template</DialogTitle>
      </DialogHeader>
      {loading?<p className="py-8 text-sm text-muted-foreground">Reading the latest saved edit…</p>:null}
      {error?<p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>:null}
      {inspection?<div className="space-y-5">
        <div className="space-y-1">
          <Label>Save destination</Label>
          <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={versionTarget}
            onChange={e=>{
              const id=e.target.value
              setVersionTarget(id)
              if(!id){setTitle(defaultTitle);setDescription('');return}
              const target=existingTemplates.find(x=>x.id===id)
              if(target){setTitle(target.title);setDescription(target.description)}
            }}>
            <option value="">New private template</option>
            {existingTemplates.map(t=><option key={t.id} value={t.id}>{t.title} · revision {t.currentRevision}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{versionTarget
            ? 'Creates a new revision. Existing projects stay pinned to the revision they used.'
            : 'Creates a separate private template; the current project remains unchanged.'}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="space-y-1">Template title
            <Input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} />
          </Label>
          <Label className="space-y-1">Description
            <Input value={description} maxLength={1000} onChange={e=>setDescription(e.target.value)} placeholder="What should someone replace or edit?" />
          </Label>
        </div>
        <section className="space-y-3">
          <div><h3 className="font-semibold">Choose each media item</h3>
            <p className="text-xs text-muted-foreground">Every source must be explicitly replaceable or intentionally kept private. Nothing is flattened.</p></div>
          {inspection.replaceable.map((item,index)=><fieldset key={item.key} className="rounded-xl border p-3">
            <legend className="px-1 text-sm font-medium">{item.label}</legend>
            <p className="mb-2 text-xs text-muted-foreground">{item.media==='either'?'Photo or video':item.media} · needs {fmt(item.minDurationMs)}</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="radio" name={'media-'+index}
                checked={choices[item.key]==='slot'} onChange={()=>setChoices(p=>({...p,[item.key]:'slot'}))} />
                Replaceable numbered slot</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name={'media-'+index}
                checked={choices[item.key]==='keep'} onChange={()=>setChoices(p=>({...p,[item.key]:'keep'}))} />
                Keep this private asset</label>
            </div>
          </fieldset>)}
        </section>
        {inspection.textFields.length?<section className="space-y-2">
          <h3 className="font-semibold">Editable text fields</h3>
          {inspection.textFields.map(field=><label key={field.id} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={Boolean(editableText[field.id])}
              onChange={e=>setEditableText(p=>({...p,[field.id]:e.target.checked}))} />
            <span><span className="font-medium">{field.label}</span><span className="block text-xs text-muted-foreground">Example: {field.text}</span></span>
          </label>)}
        </section>:null}
        {inspection.musicPresent?<fieldset className="space-y-2 rounded-xl border p-3">
          <legend className="px-1 text-sm font-semibold">Music policy</legend>
          {([['replace','Make music replaceable'],['mute','Save without music'],['keep','Keep this private soundtrack']] as const).map(([id,label])=>
            <label key={id} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="radio" name="music-policy"
              checked={musicPolicy===id} onChange={()=>setMusicPolicy(id)} />{label}</label>)}
        </fieldset>:null}
        {nonReplaceable.length?<section className="space-y-2">
          <h3 className="font-semibold">Other private dependencies</h3>
          <p className="text-xs text-muted-foreground">Select each item you intentionally want this private template to retain. These prevent public submission until removed or replaced.</p>
          {nonReplaceable.map(dep=><label key={dep.key} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" checked={Boolean(extraDecorative[dep.key])}
              onChange={e=>setExtraDecorative(p=>({...p,[dep.key]:e.target.checked}))} />
            {dep.label} <span className="text-xs text-muted-foreground">({dep.kind})</span>
          </label>)}
        </section>:null}
        <section className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
          <Label className="space-y-1">Preview start (ms)
            <Input type="number" min={0} max={Math.max(0,inspection.durationMs-1)} value={previewStart}
              onChange={e=>setPreviewStart(Math.max(0,Math.min(inspection.durationMs-1,Number(e.target.value)||0)))} />
          </Label>
          <Label className="space-y-1">Preview end (ms)
            <Input type="number" min={1} max={inspection.durationMs} value={previewEnd}
              onChange={e=>setPreviewEnd(Math.max(previewStart+1,Math.min(inspection.durationMs,Number(e.target.value)||1)))} />
          </Label>
        </section>
        <section className="rounded-xl border bg-muted/30 p-4" aria-label="Resulting template fill preview">
          <h3 className="font-semibold">Fill experience preview</h3>
          {!complete?<p className="mt-1 text-sm text-muted-foreground">Choose Slot or Keep for every media item{inspection.musicPresent?' and choose a music policy':''}.</p>:
            <div className="mt-2 space-y-2 text-sm">
              <ol className="list-decimal space-y-1 pl-5">{slotItems.map(x=><li key={x.key}>{x.label} · {x.media} · {fmt(x.minDurationMs)} minimum</li>)}</ol>
              <p>{inspection.textFields.filter(x=>editableText[x.id]).length} editable text field(s) · {inspection.aspect} · revision source v{inspection.editsSaveVersion}</p>
              <p className="text-xs text-muted-foreground">Using this template creates a new project with the same editable cuts, transitions, keyframes, text/graphics, audio tracks and per-clip effects.</p>
            </div>}
        </section>
        {inspection.warnings.map(w=><p key={w} className="text-xs text-muted-foreground">{w}</p>)}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={()=>void save()} disabled={!complete||!title.trim()||saving}>{saving?'Saving…':versionTarget?'Save new revision':'Save private template'}</Button>
        </div>
      </div>:null}
    </DialogContent>
  </Dialog>
}
