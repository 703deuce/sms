import { ClipGridSkeleton } from './clip-grid-skeleton'
import { formatEtaSeconds } from '../../lib/clips/format-eta'

export function UnifiedClipProgress({
  clipsReady = 0,
  clipsTotal = 0,
  etaSec = 0,
  stage = null,
}: {
  clipsReady?: number
  clipsTotal?: number
  etaSec?: number
  stage?: string | null
}) {
  const etaLine = etaSec > 0 ? `ETA ${formatEtaSeconds(etaSec)}` : 'Finding Story and Continuous clips…'
  const detail =
    clipsTotal > 0
      ? `${clipsReady} of ${clipsTotal} ready`
      : stage
        ? stage.replace(/_/g, ' ')
        : 'This usually takes a few minutes.'
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border bg-card/60 p-5"
      data-testid="unified-clip-progress"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{etaLine}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <ClipGridSkeleton count={4} />
    </div>
  )
}
