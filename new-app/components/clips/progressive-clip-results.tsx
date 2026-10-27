'use client'

import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { ClipGridSkeleton } from '@/components/clips/clip-grid-skeleton'
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
}

function reframeLabel(stage: string | null | undefined): string | null {
  const m = (stage ?? '').match(/^reframe_(\d+)_of_(\d+)$/i)
  if (!m) return null
  return `Reframing clip ${m[1]} of ${m[2]}`
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
}: Props) {
  const pending = Math.max(0, clipsTotal - clips.length)
  const reframe = reframeLabel(stage)
  const etaLine = etaSec > 0 ? `ETA ${formatEtaSeconds(etaSec)}` : reframe || 'Reframing clips…'

  return (
    <Panel
      title={clipsTotal > 0 ? `Clips (${clips.length} of ${clipsTotal} ready)` : `Clips (${clips.length} ready)`}
      description={etaLine}
    >
      <div className="flex flex-col gap-4">
        {clips.length > 0 ? (
          <ClipGrid
            clips={clips}
            projectId={projectId}
            onDownload={onDownload ?? (() => {})}
            onHidden={onHidden}
            isStreamer={false}
            cardAspect={cardAspect}
          />
        ) : null}
        {pending > 0 ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-xs text-muted-foreground">
              {clipsReady > clips.length
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
