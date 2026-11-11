'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Reason='abuse'|'privacy'|'copyright'|'spam'
export function ReportCommunityTemplateDialog({publicationId,title,onClose,onReported}:{
  publicationId:string|null
  title:string
  onClose:()=>void
  onReported:()=>void
}){
  const [reason,setReason]=useState<Reason>('abuse')
  const [details,setDetails]=useState('')
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{if(publicationId){setReason('abuse');setDetails('');setError(null)}},[publicationId])
  const submit=async()=>{
    if(!publicationId)return
    setSaving(true);setError(null)
    try{
      const response=await fetch('/api/clips/video-templates/community/'+encodeURIComponent(publicationId)+'/report',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reason,details}),
      })
      const body=await response.json() as {data?:{id:string};error?:string}
      if(!response.ok||!body.data)throw new Error(body.error??'Could not submit report')
      onReported();onClose()
    }catch(e){setError(e instanceof Error?e.message:'Could not submit report')}
    finally{setSaving(false)}
  }
  return <Dialog open={Boolean(publicationId)} onOpenChange={open=>{if(!open&&!saving)onClose()}}>
    <DialogContent className="max-w-lg" data-testid="community-template-report-dialog">
      <DialogHeader><DialogTitle>Report community template</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Report “{title}” for moderator review. Reports do not automatically delete existing user work.</p>
      <Label className="space-y-1">Reason
        <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={reason}
          onChange={e=>setReason(e.target.value as Reason)}>
          <option value="abuse">Abuse / prohibited content</option>
          <option value="privacy">Privacy / private material</option>
          <option value="copyright">Copyright / licensing</option>
          <option value="spam">Spam / deceptive listing</option>
        </select>
      </Label>
      <Label className="space-y-1">Details
        <textarea className="min-h-28 w-full rounded-lg border bg-background p-3 text-sm" maxLength={1200}
          value={details} onChange={e=>setDetails(e.target.value)}
          placeholder="Describe what the moderator should review. Do not paste private credentials or external URLs." />
      </Label>
      {error?<p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>:null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={()=>void submit()} disabled={saving}>{saving?'Sending…':'Submit report'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
