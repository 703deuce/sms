'use client'

import Link from 'next/link'
import {useCallback,useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import type {MsPortableManifest} from '@/lib/motion-studio/portable-contract'
import type {BrowserSceneSession} from './universal-timeline-player'
import {PortableLiveFilmPlayer} from './portable-live-film-player'

type Version={id:string;manifest:MsPortableManifest;theme:Record<string,unknown>;
  overrides:Record<string,unknown>}
type Playback={versionId:string;sessions:BrowserSceneSession[];
  mediaUrls:Record<string,string>}
type ProjectData={version:Version|null;playback?:Playback|null}

/** Watch-only delivery page. All edits belong to the existing Compact Editor;
 * no separate live layer inspector, saving controls or second editor route.
 */
export function LiveProjectPreviewPage({projectId}:{projectId:string}){
  const router=useRouter()
  const [data,setData]=useState<ProjectData|null>(null)
  const [mp4,setMp4]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [opening,setOpening]=useState(false)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const path='/api/motion-studio/projects/'+encodeURIComponent(projectId)
      // MP4 is the immediate preview, but the signed live project remains
      // available for older masterless jobs without flattening a new video.
      const [project,preview]=await Promise.all([
        fetch(path+'/portable?bootstrap=1',{cache:'no-store'}),
        fetch(path+'/portable/preview',{cache:'no-store'}),
      ])
      if(!project.ok)throw Error('Could not load your video preview')
      const item=await project.json() as ProjectData
      if(!item.version)throw Error('Editable video is not ready yet')
      const signed=preview.ok?await preview.json() as {url?:string|null}:null
      setData(item);setMp4(signed?.url||null)
    }catch(e){setError(e instanceof Error?e.message:'Preview unavailable')}
    finally{setLoading(false)}
  },[projectId])
  useEffect(()=>{void load()},[load])
  const openCompact=async()=>{
    if(opening||!mp4)return
    setOpening(true);setError('')
    try{
      const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/open-in-editor',{
        method:'POST',headers:{'Content-Type':'application/json'},
      })
      if(!response.ok)throw Error('Compact Editor could not be opened yet')
      const handoff=await response.json() as {clipProjectId:string;clipId:string}
      router.push('/app/video-editor/'+encodeURIComponent(handoff.clipProjectId)+
        '/edit/'+encodeURIComponent(handoff.clipId)+'?motionStudio='+encodeURIComponent(projectId))
    }catch(e){setError(e instanceof Error?e.message:'Could not open Compact Editor')}
    finally{setOpening(false)}
  }
  const version=data?.version
  return <div className="flex min-w-0 flex-col gap-4" data-testid="ms-live-preview-page">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">Video preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Watch your finished video here. To edit scenes, text, motion graphics or audio,
          open the Compact Editor.
        </p>
      </div>
      <button type="button" title={!mp4?'The original MP4 must be ready before opening Compact Editor':undefined}
        onClick={()=>void openCompact()}
        disabled={opening||!version||!mp4}
        data-testid="ms-preview-open-compact"
        className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
        {opening?'Opening Compact Editor…':'Open Compact Editor'}
      </button>
    </div>
    {!loading&&version&&!mp4?<p className="text-sm text-muted-foreground" role="status">
      Native scene playback is available. Compact editing becomes available when this project has an approved MP4 canvas.
    </p>:null}
    {error?<div role="alert" className="text-sm text-destructive">{error}
      <button type="button" className="ml-2 underline" onClick={()=>void load()}>Retry</button>
    </div>:null}
    {loading?<div role="status" className="flex min-h-40 items-center justify-center rounded-lg border text-sm text-muted-foreground">
      Loading video preview…
    </div>:null}
    {version&&!loading?(mp4?
      <video key={mp4} controls playsInline preload="auto" src={mp4}
        className="aspect-video w-full rounded-lg bg-black object-contain"
        aria-label="Finished video preview"/>:
      <PortableLiveFilmPlayer projectId={projectId} versionId={version.id}
        manifest={version.manifest} theme={version.theme} overrides={version.overrides}
        initialPlayback={data?.playback||null}/>):null}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>This screen is for playback only. Your editable layers are in Compact Editor.</span>
      <Link className="underline" href={'/app/motion-studio/'+encodeURIComponent(projectId)+'?view=workspace'}>
        Production details and version history
      </Link>
    </div>
  </div>
}
