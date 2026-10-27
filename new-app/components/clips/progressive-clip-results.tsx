'use client'

import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { ClipGridSkeleton } from '@/components/clips/clip-grid-skeleton'
import { ProjectPeopleStrip } from '@/components/clips/project-people-strip'
import { Panel } from '@/components/app/page-primitives'
import { formatEtaSeconds } from '@/lib/clips/format-eta'
import type { ExportAspect } from '@/lib/clips/export-aspect'

type Props = {
  projectId: string
  clips: ClipCardData[]
  clipsTotal?: number
  clipsReady?: number
  etaSec?: number
  stage?: string | null
  onDownload?: (clipId: string) => void
  onHidden?: (clipId: string) => void
  cardAspect?: ExportAspect
  isStreamer?: boolean
}

function reframeLabel(stage: string | null | undefined): string | null {
  const m = (stage ?? '').match(/^reframe_(\d+)_of_(\d+)$/i)
  if (m) return `Reframing clip ${m[1]} of ${m[2]}`
  const render = (stage ?? '').match(/^Rendering\s+(\d+)\/(\d+)$/i)
  if (render) return `Rendering clip ${render[1]} of ${render[2]}`
  return null
}

export function ProgressiveClipResults({
  projectId,
  clips,
  clipsTotal = 0,
  clipsReady = 0,
  etaSec = 0,
  stage,
  onDownload,
  onHidden,
  cardAspect = '9:16',
  isStreamer = false,
}: Props) {
  const readyClips = clips.filter((c) => Boolean(c.previewUrl))
  const pending = clipsTotal > 0 ? Math.max(0, clipsTotal - readyClips.length) : 0
  const reframe = reframeLabel(stage)
  const etaLine = etaSec > 0 ? `ETA ${formatEtaSeconds(etaSec)}` : reframe || 'Reframing clips…'

  return (
    <Panel
      title={
        clipsTotal > 0
          ? `Clips (${readyClips.length} of ${clipsTotal} ready)`
          : `Clips (${readyClips.length} ready)`
      }
      description={etaLine}
    >
      <div className="flex flex-col gap-4">
        {readyClips.length > 0 ? <ProjectPeopleStrip clips={readyClips} /> : null}
        {readyClips.length > 0 ? (
          <ClipGrid
            clips={readyClips}
            projectId={projectId}
            onDownload={onDownload ?? (() => {})}
            onHidden={onHidden}
            isStreamer={isStreamer}
            cardAspect={cardAspect}
          />
        ) : null}
        {pending > 0 ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-xs text-muted-foreground">
              {clipsReady > readyClips.length
                ? `Finishing clip ${clipsReady} of ${clipsTotal}…`
                : `Preparing ${pending} more clip${pending === 1 ? '' : 's'}…`}
            </p>
            <ClipGridSkeleton count={Math.min(pending, 8)} />
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
