'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Definition={
  slots:Array<{id:string;ordinal:number;label:string;media:string;target:{kind:string}}>
  textFields:Array<{id:string;label:string;exampleText:string}>
  previewRange:{startMs:number;endMs:number}
  snapshot:{aspect:string;clipStartMs:number;clipEndMs:number}
}
type Manifest={decorative:Array<{key:string;kind:string}>;musicPolicy:'keep'|'replace'|'mute'}
export type CommunitySubmitTemplate={
  id:string;title:string;description:string;currentRevision:number
  revisions:Array<{revision:number;definition:Definition;assetManifest:Manifest}>
}
export function SubmitCommunityTemplateDialog({template,onClose,onSubmitted}:{
  template:CommunitySubmitTemplate|null
  onClose:()=>void
  onSubmitted:()=>void
}){
  const revision=template?.revisions[0]
  const definition=revision?.definition
  const manifest=revision?.assetManifest
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [creatorName,setCreatorName]=useState('')
  const [category,setCategory]=useState('other')
  const [tags,setTags]=useState('')
  const [licenseTerms,setLicenseTerms]=useState('')
  const [owns,setOwns]=useState(false)
  const [people,setPeople]=useState(false)
  const [reviewedText,setReviewedText]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    if(!template)return
    setTitle(template.title);setDescription(template.description);setCreatorName('');setCategory('other');setTags('')
    setLicenseTerms('');setOwns(false);setPeople(false);setReviewedText(false);setError(null)
  },[template])
  const blockers=useMemo(()=>{
    const out:string[]=[]
    if(!definition||!manifest)return out
    if(!definition.slots.some(s=>s.target.kind==='main'))out.push('Make the main source a replaceable slot.')
    if(manifest.decorative.length)out.push('Remove or replace all private decorative assets, uploaded fonts, SFX and Studio Sound before public submission.')
    if(manifest.musicPolicy==='keep')out.push('Private music cannot be redistributed. Save a revision with replaceable music or no music.')
    return out
  },[definition,manifest])
  const submit=async()=>{
    if(!template||!revision||!definition||!manifest||blockers.length)return
    setSaving(true);setError(null)
    try{
      const response=await fetch('/api/clips/user-templates/'+encodeURIComponent(template.id)+'/submit',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
          revision:revision.revision,title,description,category,
          tags:tags.split(',').map(x=>x.trim()).filter(Boolean),
          creatorName,licenseTerms,ownsOrLicensed:owns,
          recognizablePeoplePermission:people,authorReviewedExampleText:reviewedText,
        }),
      })
      const body=await response.json() as {data?:{id:string;state:string};error?:string}
      if(!response.ok||!body.data)throw new Error(body.error??'Could not submit template')
      onSubmitted();onClose()
    }catch(e){setError(e instanceof Error?e.message:'Could not submit template')}
    finally{setSaving(false)}
  }
  return <Dialog open={Boolean(template)} onOpenChange={open=>{if(!open&&!saving)onClose()}}>
    <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto" data-testid="community-submit-dialog">
      <DialogHeader><DialogTitle>Submit to Community</DialogTitle></DialogHeader>
      {template&&revision&&definition&&manifest?<div className="space-y-5">
        <div className="rounded-xl border bg-muted/20 p-4 text-sm">
          <p className="font-medium">Nothing is published by saving privately.</p>
          <p className="mt-1 text-xs text-muted-foreground">This is a separate opt-in submission of revision {revision.revision}. Moderators must approve it before public search. If you already have a published revision, it remains live until this revision is approved.</p>
        </div>
        {blockers.length?<div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">This revision is not public-safe yet</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{blockers.map(x=><li key={x}>{x}</li>)}</ul>
          <p className="mt-2 text-xs text-muted-foreground">Open the source edit, use Save as template → existing template, and create a cleaned new revision.</p>
        </div>:null}
        <section className="space-y-2 rounded-xl border p-4">
          <h3 className="font-semibold">Exactly what becomes public after approval</h3>
          <p className="text-xs text-muted-foreground">Definition: {definition.slots.length} replaceable slot(s), {definition.textFields.length} editable text field(s), {definition.snapshot.aspect}, preview {definition.previewRange.startMs}–{definition.previewRange.endMs} ms.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border p-3"><p className="text-xs font-medium">Slot placeholders</p>
              <ol className="mt-1 list-decimal pl-4 text-xs text-muted-foreground">{definition.slots.map(s=><li key={s.id}>{s.label} · {s.media}</li>)}</ol></div>
            <div className="rounded-lg border p-3"><p className="text-xs font-medium">Author-reviewed example text</p>
              {definition.textFields.length?<ul className="mt-1 space-y-1 text-xs text-muted-foreground">{definition.textFields.map(f=><li key={f.id}>{f.label}: “{f.exampleText}”</li>)}</ul>:
                <p className="mt-1 text-xs text-muted-foreground">No editable example text.</p>}</div>
          </div>
          <p className="text-xs text-muted-foreground">Preview: sanitized placeholder metadata only. Private source uploads, raw URLs, signed URLs, transcripts and credentials are not published. Decorative assets eligible now: {manifest.decorative.length===0?'none':'blocked'}.</p>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="space-y-1">Public title<Input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} /></Label>
          <Label className="space-y-1">Creator attribution<Input value={creatorName} maxLength={80} onChange={e=>setCreatorName(e.target.value)} placeholder="Name shown publicly" /></Label>
          <Label className="space-y-1 sm:col-span-2">Description<Input value={description} maxLength={1000} onChange={e=>setDescription(e.target.value)} /></Label>
          <Label className="space-y-1">Category<select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={category} onChange={e=>setCategory(e.target.value)}>
            {['gaming','podcast','social','business','education','lifestyle','other'].map(x=><option key={x} value={x}>{x}</option>)}</select></Label>
          <Label className="space-y-1">Tags<Input value={tags} maxLength={260} onChange={e=>setTags(e.target.value)} placeholder="gaming, fast, vertical" /></Label>
          <Label className="space-y-1 sm:col-span-2">Publication / reuse license terms
            <Input value={licenseTerms} maxLength={600} onChange={e=>setLicenseTerms(e.target.value)} placeholder="State the permissions end users receive to reuse/export this template." />
          </Label>
        </div>
        <section className="space-y-2 rounded-xl border p-4">
          <h3 className="font-semibold">Rights confirmation</h3>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={owns} onChange={e=>setOwns(e.target.checked)} />
            <span>I own or have licenses that permit public template publication and the end-user reuse/export described above.</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={people} onChange={e=>setPeople(e.target.checked)} />
            <span>I have permission for any recognizable people or private material included in the public preview.</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={reviewedText} onChange={e=>setReviewedText(e.target.checked)} />
            <span>I reviewed the exact example text shown above and approve it for public display.</span></label>
        </section>
        {error?<p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>:null}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={saving||blockers.length>0||!title.trim()||!creatorName.trim()||!licenseTerms.trim()||!owns||!people||!reviewedText}
            onClick={()=>void submit()}>{saving?'Submitting…':'Submit for human review'}</Button></div>
      </div>:null}
    </DialogContent>
  </Dialog>
}
