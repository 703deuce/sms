'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Film, Loader2 } from 'lucide-react'
import { getMotionStudioClient } from '@/lib/motion-studio'
import { MotionStudioHttpError, type MotionStudioClient } from '@/lib/motion-studio/client'
import { MOTION_STUDIO_NAME, MOTION_STUDIO_ROUTE } from '@/lib/motion-studio/config'
import { sceneAt } from '@/lib/motion-studio/timeline'
import type { MsProject } from '@/lib/motion-studio/types'
import { MotionStudioTracks } from './motion-studio-tracks'
import { AgentChatPanel } from './agent-chat-panel'

/**
 * Motion Studio lanes mounted inside the existing Compact Editor (EditorShell `motionStudioSlot`).
 * Read-only lanes keyed to the editor playhead; edits still go through the editor's own timeline and save path.
 */
export function MotionStudioEditorLanes({
  projectId,
  outputMs,
  onSeek,
  client: injected,
}: {
  projectId: string
  outputMs: number
  onSeek: (ms: number) => void
  client?: MotionStudioClient
}) {
  const client = useMemo(() => injected ?? getMotionStudioClient(), [injected])
  const [project, setProject] = useState<MsProject | null>(null)
  const [agentTracks, setAgentTracks] = useState<{ id: string; label: string; items: { id: string; startMs: number; endMs: number }[] }[] | null>(null)
  const [agentDurationMs, setAgentDurationMs] = useState(0)
  const [selectedAgentElementId, setSelectedAgentElementId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    client
      .getProject(projectId)
      .then((p) => alive && setProject(p))
      .catch((err) => {
        if (!alive) return
        setError(
          err instanceof MotionStudioHttpError && err.status === 404
            ? 'project not found in this workspace.'
            : err instanceof Error
              ? err.message
              : 'Could not load the Motion Studio lanes.',
        )
      })
    if (client.mode === 'live') {
      void fetch('/api/motion-studio/projects/' + encodeURIComponent(projectId) + '/timeline?passive=1',
        {cache: 'no-store'}).then(r=>r.ok?r.json():null).then((response: {
          edits?: { motionStudio?: { tracks?: {id:string;label:string;items:object[]}[];durationMs?:number } }
        } | null) => {
          if (!alive) return
          const ext = response?.edits?.motionStudio
          if (ext?.tracks?.length) {
            setAgentTracks(ext.tracks.map(t=>({
              id:t.id,label:t.label,items:(t.items ?? []).map(v=>{
                const o=v as { id?:string;startMs?:number;endMs?:number }
                return {id:String(o.id??''),startMs:Number(o.startMs)||0,endMs:Number(o.endMs)||0}
              }).filter(x=>x.endMs>x.startMs)
            })))
            setAgentDurationMs(ext.durationMs || 0)
          }
        }).catch(()=>{/* The legacy project lanes remain available. */})
    }
    return () => {
      alive = false
    }
  }, [client, projectId])

  if (error)
    return (
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground" role="status" data-testid="ms-editor-lanes-error">
        Motion Studio lanes unavailable: {error}
        <Link href={MOTION_STUDIO_ROUTE} className="text-primary hover:underline">Back to Motion Studio</Link>
      </p>
    )
  if (!project)
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground" aria-busy="true">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
        Loading Motion Studio lanes…
      </p>
    )
  const current = sceneAt(project.scenes, outputMs)
  return (
    <div className="flex flex-col gap-2" data-testid="ms-editor-lanes">
      <div className="flex items-center gap-2 text-xs">
        <Film className="size-3.5 text-lane-ai" aria-hidden />
        <span className="font-medium">{MOTION_STUDIO_NAME}</span>
        <span className="truncate text-muted-foreground">· {project.title}{current ? ` · Scene ${current.index + 1}: ${current.title}` : ''}</span>
        <Link href={`${MOTION_STUDIO_ROUTE}/${encodeURIComponent(project.id)}`} className="ml-auto inline-flex items-center gap-1 rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <ArrowLeft className="size-3" aria-hidden />
          Back to workspace
        </Link>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="ms-editor-program-note">
        Each scene and footage insert is its own clip on the Video track, narration stays with the picture, and the score is on the Music track. Trim, delete, mute or swap them here. To redesign a scene, ask the Director in Motion Studio; only that scene re-renders, and this cut updates the next time you open it.
      </p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 overflow-x-auto">
          {agentTracks?.length ? <div className="min-w-[560px] space-y-2 rounded-lg border border-border p-3"
            aria-label="Imported production tracks" data-testid="ms-agent-timeline-tracks">
            {agentTracks.map(track=><div key={track.id} className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground">{track.label}</span>
              <div className="relative h-8 rounded bg-muted">
                {track.items.map(item=>{
                  const total=Math.max(1,agentDurationMs)
                  const left=Math.min(100,100*item.startMs/total)
                  const width=Math.max(0.5,100*(item.endMs-item.startMs)/total)
                  return <button type="button" key={item.id} title={item.id}
                    onClick={()=>{setSelectedAgentElementId(item.id);onSeek(item.startMs)}}
                    className="absolute top-1 h-6 truncate rounded border border-primary/20 bg-primary/20 px-1 text-left text-[10px] hover:bg-primary/30"
                    style={{left:left+'%',width:Math.min(100-left,width)+'%'}}>
                    {item.id}
                  </button>
                })}
              </div>
            </div>)}
          </div> : <div className="min-w-[560px]">
            <MotionStudioTracks project={project} playheadMs={outputMs} selectedSceneId={current?.id ?? null} onSeek={onSeek} />
          </div>}
        </div>
        <AgentChatPanel projectId={projectId} selectedElementIds={selectedAgentElementId ? [selectedAgentElementId] : current ? [current.id] : []} selectedTimeMs={outputMs} />
      </div>
    </div>
  )
}
