'use client'
import {useCallback,useEffect,useState} from 'react'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'

type RenderJob={id:string;status:string;error?:string|null;versionId:string;
  publishedVersionId?:string|null}
const endpoint=(projectId:string)=>'/api/motion-studio/projects/'+
  encodeURIComponent(projectId)+'/portable/render-project'

/** Customer-controlled export of the saved live timeline.
 * No render starts on opening the project, previewing, saving or mounting
 * this dialog. Only the Export button submits the deterministic render job.
 */
export function LiveExportDialog({open,onOpenChange,projectId,title}:{
  open:boolean;onOpenChange:(open:boolean)=>void;projectId:string;title:string
}){
  const [jobId,setJobId]=useState('')
  const [status,setStatus]=useState('')
  const [message,setMessage]=useState('')
  const [downloadUrl,setDownloadUrl]=useState('')
  const [busy,setBusy]=useState(false)
  const refresh=useCallback(async()=>{
    if(!jobId)return
    const response=await fetch(endpoint(projectId)+'/'+encodeURIComponent(jobId),
      {cache:'no-store'})
    if(!response.ok)throw Error('Could not check final export')
    const data=await response.json() as {job:RenderJob;downloadUrl?:string|null}
    setStatus(data.job.status)
    if(data.downloadUrl)setDownloadUrl(data.downloadUrl)
    if(data.job.status==='failed')setMessage(data.job.error||'Final render failed')
  },[jobId,projectId])
  useEffect(()=>{
    if(!open||!jobId||['complete','failed','cancelled'].includes(status))return
    void refresh().catch(()=>undefined)
    const timer=window.setInterval(()=>void refresh().catch(()=>undefined),4000)
    return()=>window.clearInterval(timer)
  },[open,jobId,status,refresh])
  const submit=async()=>{
    if(busy)return
    setBusy(true);setMessage('')
    try{
      // Resolve latest committed immutable version at click time.
      const projectResponse=await fetch('/api/motion-studio/projects/'+
        encodeURIComponent(projectId)+'/portable',{cache:'no-store'})
      if(!projectResponse.ok)throw Error('Editable project is not available')
      const payload=await projectResponse.json() as {version?:{id:string;revision:number}|null}
      if(!payload.version)throw Error('Save the editable project before exporting')
      const response=await fetch(endpoint(projectId),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({versionId:payload.version.id,
          idempotencyKey:'final-'+payload.version.id}),
      })
      const data=await response.json() as {id?:string;status?:string;message?:string;error?:string}
      if(!response.ok||!data.id)throw Error(data.message||data.error||'Export could not start')
      setDownloadUrl('');setJobId(data.id);setStatus(data.status||'queued')
    }catch(e){setMessage(e instanceof Error?e.message:'Export failed to start')}
    finally{setBusy(false)}
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md" data-testid="ms-live-export-dialog">
      <DialogHeader>
        <DialogTitle>Export MP4</DialogTitle>
        <DialogDescription>{title} · Export the latest saved timeline</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          Your video plays and remains editable in the browser. MP4 rendering
          starts only after you press Export. Save any pending changes first.
        </p>
        {jobId?<p role="status" className="text-xs">
          {status==='complete'?'Your MP4 is ready':status==='failed'?'Export failed':
            'Final export: '+(status||'queued')}
        </p>:null}
        {message?<p className="text-xs text-destructive" role="alert">{message}</p>:null}
        <div className="flex justify-end gap-2">
          {status==='complete'?<>
            <Button variant="outline" onClick={()=>void refresh().catch(e=>
              setMessage(e instanceof Error?e.message:'Could not refresh download'))}>
              Refresh link
            </Button>
            {downloadUrl?<a href={downloadUrl} download={title+'.mp4'} rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Download MP4
            </a>:null}
          </>:<Button onClick={()=>void submit()}
            disabled={busy||['queued','reserved','running'].includes(status)}>
            {busy?'Submitting…':status==='failed'?'Retry export':'Export MP4'}
          </Button>}
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
