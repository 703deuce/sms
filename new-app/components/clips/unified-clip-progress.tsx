import { ClipGridSkeleton } from './clip-grid-skeleton'
import { formatEtaSeconds } from '../../lib/clips/format-eta'

export function UnifiedClipProgress({
  clipsReady = 0,
  clipsTotal = 0,
  etaSec = 0,
  stage = 'Starting',
}: {
  clipsReady?: number
  clipsTotal?: number
  etaSec?: number
  stage?: string | null
}) {
  const stageLabel = (stage ?? 'Starting').replace(/_/g, ' ')
  const etaLine = etaSec > 0 ? `ETA ${formatEtaSeconds(etaSec)}` : stageLabel === 'Starting' ? 'Starting' : 'Finding Story and Continuous clips…'
  const knownReady = Math.max(0, Math.trunc(Number.isFinite(clipsReady) ? clipsReady : 0))
  const knownTotal = Math.max(0, Math.trunc(Number.isFinite(clipsTotal) ? clipsTotal : 0))
  const detail =
    knownTotal >= knownReady && knownTotal > 0
      ? `${knownReady} of ${knownTotal} ready`
      : knownReady > 0
        ? `${knownReady} ready`
        : stageLabel === 'Starting'
          ? 'Finding Story and Continuous clips…'
          : stageLabel
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
