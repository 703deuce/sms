'use client'
import {useCallback,useEffect,useState} from 'react'
import type {MsPortableManifest} from '@/lib/motion-studio/portable-contract'
import type {BrowserSceneSession} from './universal-timeline-player'
import {PortableLiveFilmPlayer} from './portable-live-film-player'

type Version={id:string;manifest:MsPortableManifest;theme:Record<string,unknown>;
  overrides:Record<string,unknown>}
type Playback={versionId:string;sessions:BrowserSceneSession[];
  mediaUrls:Record<string,string>}
type ResponseData={version:Version|null;playback?:Playback|null}

/** The SAME Compact canvas: approved master stays underneath until native
 * scene frames are painted. Once ready, the original editable scene runtime
 * follows Compact's playhead instead of opening a second editor or transport.
 */
export function MotionStudioCompactLiveCanvas({projectId,outputMs}:{
  projectId:string;outputMs:number
}){
  const [data,setData]=useState<ResponseData|null>(null)
  const load=useCallback(async()=>{
    const response=await fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
      '/portable?bootstrap=1',{cache:'no-store'})
    if(!response.ok)throw new Error('Live canvas unavailable')
    const result=await response.json() as ResponseData
    setData(result)
  },[projectId])
  useEffect(()=>{
    let active=true
    void load().catch(()=>{if(active)setData(null)})
    const changed=(event:Event)=>{
      const detail=(event as CustomEvent<{projectId?:string}>).detail
      if(detail?.projectId===projectId)void load().catch(()=>undefined)
    }
    window.addEventListener('motion-studio:portable-updated',changed)
    return()=>{active=false;window.removeEventListener('motion-studio:portable-updated',changed)}
  },[load,projectId])
  const version=data?.version
  const playback=data?.playback
  if(!version||!playback||playback.versionId!==version.id)return null
  return <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    aria-label="Editable native Motion Studio scene preview">
    <PortableLiveFilmPlayer key={version.id} projectId={projectId} versionId={version.id}
      manifest={version.manifest} theme={version.theme} overrides={version.overrides}
      initialPlayback={playback} embeddedCanvas externalTimeMs={outputMs}/>
  </div>
}
