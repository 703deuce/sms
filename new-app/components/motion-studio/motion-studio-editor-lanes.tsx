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
import {MotionStudioCompactLayerEditor} from './motion-studio-compact-layer-editor'
import { AgentChatPanel } from './agent-chat-panel'
import { startPolling } from '@/lib/motion-studio/poll'

/**
 * Motion Studio lanes mounted inside the existing Compact Editor (EditorShell `motionStudioSlot`).
 * Scene/footage/audio lane summaries plus native scene-object editing. Compact
 * keeps its own timeline edits; native layer properties save as portable revisions.
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
  const [agentTracks, setAgentTracks] = useState<{ id: string; label: string; kind?: string; items: { id: string; startMs: number; endMs: number }[] }[] | null>(null)
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
    // Passive reads only: never start an import while React mounts the editor.
    // Poll briefly so separated lanes appear if the async manifest import finishes later.
    // Sequential (>= 5s), paused in hidden tabs, and bounded: stop when the lanes arrive
    // or after ~24 attempts (the import either finished or is not coming).
    let stopTracks: (() => void) | null = null
    if (client.mode === 'live') {
      let attempts = 0
      const loadTracks = async (): Promise<boolean> => {
        attempts += 1
        const response = await fetch('/api/motion-studio/projects/' + encodeURIComponent(projectId) + '/timeline?passive=1',
          { cache: 'no-store' })
        if (!alive) return false
        if (!response.ok) {
          if (attempts >= 24) return false
          throw new Error('Lanes are not available yet.')
        }
        const data = await response.json() as {
          edits?: { motionStudio?: { tracks?: { id: string; label: string; kind?: string; items: object[] }[]; durationMs?: number } }
        }
        const ext = data.edits?.motionStudio
        if (!alive) return false
        if (!ext?.tracks?.length) return attempts < 24
        setAgentTracks(ext.tracks.map(t => ({
          id: t.id, label: t.label, kind: t.kind, items: (t.items ?? []).map(v => {
            const o = v as { id?: string; startMs?: number; endMs?: number }
            return { id: String(o.id ?? ''), startMs: Number(o.startMs) || 0, endMs: Number(o.endMs) || 0 }
          }).filter(x => x.endMs > x.startMs)
        })))
        setAgentDurationMs(ext.durationMs || 0)
        return false
      }
      stopTracks = startPolling(loadTracks, { intervalMs: 5000, maxIntervalMs: 30000, immediate: true })
    }
    return () => {
      alive = false
      stopTracks?.()
    }
  }, [client, projectId])

  // Native editable layers must load independently; do not hide them because
  // optional legacy Motion Studio summaries have not finished polling.
  const legacyLoading=!project&&!agentTracks?.length

  const groups = new Map<string, NonNullable<typeof agentTracks>>()
  for (const track of agentTracks ?? []) {
    const role = [track.id, track.kind, track.label].join(' ')
    let group = 'Main Visuals'
    if (/ad[ _-]?libs?/i.test(role)) group = 'Ad-libs'
    else if (/narrat|voice|dialog|speech/i.test(role)) group = 'Main Voice'
    else if (/music|score|sfx|audio|sound/i.test(role)) group = 'Music and audio'
    const members = groups.get(group) ?? []
    members.push(track)
    groups.set(group, members)
  }
  const current = project ? sceneAt(project.scenes, outputMs) : null
  return (
    <div className="flex flex-col gap-2" data-testid="ms-editor-lanes">
      <div className="flex items-center gap-2 text-xs">
        <Film className="size-3.5 text-lane-ai" aria-hidden />
        <span className="font-medium">{MOTION_STUDIO_NAME}</span>
        <span className="truncate text-muted-foreground">· {project?.title ?? 'Your video'}{current ? ` · Scene ${current.index + 1}: ${current.title}` : ''}</span>
        <Link href={`${MOTION_STUDIO_ROUTE}/${encodeURIComponent(projectId)}`} className="ml-auto inline-flex items-center gap-1 rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <ArrowLeft className="size-3" aria-hidden />
          Back to workspace
        </Link>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="ms-editor-program-note">
        Each scene and footage insert is its own clip on the Video track, narration stays with the picture, and the score is on the Music track. Trim, delete, mute or swap video items in Compact. The original motion-graphics layers above are selectable and saved as native scene properties; these are not flattened into an extra MP4 layer.
      </p>
      {error&&!agentTracks?.length?<p className="text-xs text-muted-foreground" role="status">Legacy lane summary unavailable: {error}</p>:null}
      {legacyLoading?<p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin"/>Loading track summary…</p>:null}
      <MotionStudioCompactLayerEditor projectId={projectId} outputMs={outputMs} onSeek={onSeek}/>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 overflow-x-auto">
          {agentTracks?.length ? <div className="min-w-[560px] space-y-2 rounded-lg border border-border p-3"
            aria-label="Imported production tracks" data-testid="ms-agent-timeline-tracks">
            {Array.from(groups, ([group, tracks]) => <details key={group}>
              <summary className="cursor-pointer py-1 text-xs font-medium">{group} · {tracks.length}</summary>
              {tracks.map(track=><div key={track.id} className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
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
            </details>)}
          </div> : project ? <div className="min-w-[560px]">
            <MotionStudioTracks project={project} playheadMs={outputMs} selectedSceneId={current?.id ?? null} onSeek={onSeek} />
          </div> : <p className="text-xs text-muted-foreground">We're loading your saved tracks…</p>}
        </div>
        <AgentChatPanel projectId={projectId} selectedElementIds={selectedAgentElementId ? [selectedAgentElementId] : current ? [current.id] : []} selectedTimeMs={outputMs} />
      </div>
    </div>
  )
}
