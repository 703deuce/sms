'use client'
import {useState} from 'react'
import {PortableElementsPanel} from './portable-elements-panel'
import {LiveExportDialog} from './live-export-dialog'

/** General-purpose editor entrypoint: no producer job or MP4 required.
 * Native footage projects, clipper output and motion projects all use the
 * same portable timeline playback and immutable save system.
 */
export function LiveProjectEditorPage({projectId}:{
  projectId:string
}){
  const [exportOpen,setExportOpen]=useState(false)
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">Live video editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Play, edit and save the timeline without rendering an MP4.
        </p>
      </div>
      <button type="button" onClick={()=>setExportOpen(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Export MP4
      </button>
    </div>
    <PortableElementsPanel projectId={projectId}/>
    <LiveExportDialog open={exportOpen} onOpenChange={setExportOpen}
      projectId={projectId} title="Transovo video"/>
  </>
}
