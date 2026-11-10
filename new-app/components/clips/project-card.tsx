import Link from 'next/link'
import { Clapperboard, Clock, Film, Loader2, Plus, Radio, Sparkles } from 'lucide-react'
import { CLIP_JOB_STATE, type ClipProjectStatusUi, ProjectStatusBadge } from '@/components/app/status'
import { Badge } from '@/components/ui/badge'
import { DurationChip } from '@/components/clips/ui/duration-chip'
import { relativeTime } from '@/lib/clips/format'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { ProjectKindBadge } from '@/components/clips/ui/kind-badge'
import { t2vProjectHref, t2vStatusLabel } from '@/lib/t2v/project-link'
import { ProjectCardQueueHint } from '@/components/clips/project-card-queue'
import { cn } from '@/lib/utils'

function isProcessing(status: string) {
  return status !== 'READY' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'DRAFT'
}

export function ProjectCard({
  project,
  selected,
  onToggleSelect,
  selectionMode,
}: {
  project: ClipProjectListItem
  selected?: boolean
  onToggleSelect?: (id: string) => void
  selectionMode?: boolean
}) {
  const isT2v = project.sourceKind === 't2v'
  const t2vLabel = t2vStatusLabel(project)
  const processing = isT2v
    ? project.t2vDraftStatus === 'ASSEMBLING' || isProcessing(project.status)
    : isProcessing(project.status)
  const statusUi = CLIP_JOB_STATE[project.status as ClipProjectStatusUi]
  const stageLabel = project.stage?.replace(/_/g, ' ') || 'Processing'
  const overlayLabel = t2vLabel ?? statusUi?.label ?? stageLabel
  const { clipCount, thumbUrl, durationMs, t2vSceneCount } = project
  const href = t2vProjectHref(project)
  const displayThumb = thumbUrl ?? project.sourceThumbUrl ?? null
  const sourceFrameUrl = project.sourceFrameUrl ?? null
  const sourceFrameStartMs = project.sourceFrameStartMs ?? 0
  const isDraft = project.status === 'DRAFT'
  const failed = project.status === 'FAILED'
  const noThumb = !displayThumb && !sourceFrameUrl
  const showThumbOverlay = processing && Boolean(displayThumb || sourceFrameUrl)
  const showPlaceholderStatus = (processing || failed) && noThumb
  const KindIcon = isT2v ? Clapperboard : project.sourceUrl ? Radio : Film

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-card border border-border bg-card transition hover:border-foreground/20',
        selected && 'ring-2 ring-primary',
      )}
    >
      {(selectionMode || onToggleSelect) && (
        <div className="absolute left-2 top-2 z-20">
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={() => onToggleSelect?.(project.id)}
            aria-label={`Select ${project.title}`}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <Link
        href={href}
        data-testid="project-card"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <div className="relative aspect-video bg-muted">
        {displayThumb ? (
          <img src={displayThumb} alt="" className="size-full object-cover" />
        ) : sourceFrameUrl ? (
          <video
            src={sourceFrameUrl}
            className="pointer-events-none size-full object-cover"
            muted
            playsInline
            preload="metadata"
            aria-hidden
            data-testid="project-source-frame"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              const target = Math.max(0, sourceFrameStartMs / 1000)
              if (Number.isFinite(video.duration) && video.duration > 0) {
                video.currentTime = Math.min(target, Math.max(0, video.duration - 0.05))
              }
              console.info('[clips:projects] source_frame_seek', {
                projectId: project.id,
                sourceFrameStartMs,
              })
            }}
          />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary to-card"
            data-testid="project-thumb-placeholder"
          >
            <div className="flex flex-col items-center gap-2 px-3 text-center">
              <span className="grid size-10 place-items-center rounded-lg bg-background/60">
                <KindIcon className="size-6 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-[13px] font-medium">
                {isDraft ? 'Draft' : showPlaceholderStatus ? overlayLabel : 'No preview yet'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isDraft ? 'Add media to start' : showPlaceholderStatus ? stageLabel : 'No preview yet'}
              </p>
            </div>
            {showPlaceholderStatus && processing ? (
              <Loader2 className="absolute bottom-4 size-6 animate-spin text-muted-foreground" aria-hidden />
            ) : null}
          </div>
        )}
        <div className="absolute left-2 top-2 z-10 flex gap-1.5">
          <ProjectKindBadge kind={isT2v ? 'video' : 'clips'} onMedia />
          {!isT2v || !t2vLabel ? (
            <ProjectStatusBadge status={project.status} showSpinner={false} onMedia />
          ) : (
            <Badge variant="onMedia">{t2vLabel}</Badge>
          )}
        </div>
        {durationMs > 0 && !processing && <DurationChip ms={durationMs} />}
        {showThumbOverlay ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-3 pt-10"
            aria-live="polite"
          >
            <Loader2 className="size-7 animate-spin text-white" aria-hidden />
            <span className="mt-2 text-center text-[11px] font-medium leading-snug text-white">{overlayLabel}</span>
            <ProjectCardQueueHint projectId={project.id} processing={processing} />
            {stageLabel.toLowerCase() !== overlayLabel.toLowerCase() ? (
              <span className="mt-0.5 text-center text-[11px] text-white/80 capitalize">{stageLabel}</span>
            ) : null}
          </div>
        ) : null}
        {showPlaceholderStatus && processing ? (
          <div className="absolute bottom-2 left-0 right-0 px-2 text-center text-[11px] text-muted-foreground">
            <ProjectCardQueueHint projectId={project.id} processing={processing} />
          </div>
        ) : null}
      </div>
      <div className="p-3.5">
        <p className="line-clamp-1 text-[13px] font-medium group-hover:text-primary">{project.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3.5" aria-hidden />
            {isT2v
              ? `${t2vSceneCount ?? 0} scene${(t2vSceneCount ?? 0) === 1 ? '' : 's'}`
              : `${clipCount} clip${clipCount === 1 ? '' : 's'}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {relativeTime(new Date(project.createdAt))}
          </span>
        </div>
      </div>
    </Link>
    </div>
  )
}

export function NewProjectTile() {
  return (
    <Link
      href="/app/clips/new"
      data-testid="project-card-new"
      className="grid aspect-video place-items-center rounded-xl border-2 border-dashed border-border transition hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-xl tile-primary">
          <Plus className="size-6" aria-hidden />
        </span>
        <span className="text-sm font-medium">New project</span>
      </div>
    </Link>
  )
}

export function ProjectGrid({
  projects,
  selectedIds,
  onToggleSelect,
  selectionMode,
}: {
  projects: ClipProjectListItem[]
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  selectionMode?: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-grid">
      <NewProjectTile />
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          selected={selectedIds?.has(p.id)}
          onToggleSelect={onToggleSelect}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  )
}
