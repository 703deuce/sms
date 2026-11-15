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
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <MotionStudioTracks project={project} playheadMs={outputMs} selectedSceneId={current?.id ?? null} onSeek={onSeek} />
        </div>
      </div>
    </div>
  )
}
