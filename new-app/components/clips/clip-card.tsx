'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScoreRing } from '@/components/clips/ui/score-ring'
import { DurationChip } from '@/components/clips/ui/duration-chip'
import type { ClipCardData } from '@/components/clips/clip-grid'
import { isScriptEditorEnabled } from '@/lib/features/script-editor'
import { formatDur, formatTimecode } from '@/lib/clips/format'
import { ReasonChips } from '@/components/streamer/reason-chips'
import { ClipCardVideo } from '@/components/clips/clip-card-video'
import {
  clipLayoutChip,
  clipPersonCount,
  clipDisplayTitle,
  clipFallbackPickLabel,
  clipTypeBadge,
  clipWhySummary,
  clipScoreTooltipLines,
  reasonTagLabel,
  type ClipAiMeta,
} from '@/lib/clips/clip-results-chips'
import { clipReasonTag } from '@/lib/clips/reason-tag'
import { clipCardAspectClass } from '@/lib/clips/card-aspect'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { ClipPostCopy } from '@/components/clips/clip-post-copy'
import { NeedsReviewBadge } from './needs-review-badge'
import { exportClipDownload } from '@/lib/clips/export-download-client'
import { CLIP_PREVIEW_EXPORT_ASPECT } from '@/lib/clips/export-preview-reuse'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { ThumbsDown, EyeOff, Mic, Eye, Sparkles, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { clipsFetch, patchClip } from '@/lib/clips-api'
import { useOpenInFullVideo } from '@/components/clips/editor/open-in-full-video-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { routes } from '@/lib/routes'

function oneLineClipWhy(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const sentence = normalized.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? normalized
  if (sentence.length <= 140) return sentence
  return `${sentence.slice(0, 137).trimEnd()}…`
}

export function ClipCard({
  clip,
  projectId,
  onDownload,
  onHidden,
  onChanged,
  isStreamer = false,
  cardAspect = '9:16' as ExportAspect,
  selected = false,
  onToggleSelect,
  projectHasUpload = false,
}: {
  clip: ClipCardData
  projectId: string
  onDownload?: (clipId: string) => void | Promise<void>
  onHidden?: (clipId: string) => void
  onChanged?: () => void
  isStreamer?: boolean
  cardAspect?: ExportAspect
  selected?: boolean
  onToggleSelect?: () => void
  projectHasUpload?: boolean
}) {
  const router = useRouter()
  const openFull = useOpenInFullVideo(clip.id, projectHasUpload)
  const [thumbBusy, setThumbBusy] = useState(false)
  const [hideBusy, setHideBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [cardActionBusy, setCardActionBusy] = useState(false)
  const aiMeta = (clip.aiMeta || {}) as ClipAiMeta & {
    whyThisClip?: string
    editorialIssues?: string[]
    needsReviewReasons?: string[]
  }
  const why = clipWhySummary(aiMeta)
  const agentWhy = typeof aiMeta.whyThisClip === 'string' ? aiMeta.whyThisClip.trim() : ''
  const fullWhy = agentWhy || why || (clip.reason && clip.reason !== 'ai_producer' ? clip.reason.trim() : '')
  const shortWhy = oneLineClipWhy(fullWhy)
  if (fullWhy && fullWhy !== shortWhy) {
    console.info('[clips:cards] why_collapsed', {
      clipId: clip.id,
      fullChars: fullWhy.length,
      summaryChars: shortWhy.length,
    })
  }
  const detailNotes = Array.from(new Set([
    ...(fullWhy && fullWhy !== shortWhy ? [fullWhy] : []),
    ...(Array.isArray(aiMeta.editorialIssues) ? aiMeta.editorialIssues : []),
    ...(Array.isArray(aiMeta.needsReviewReasons) ? aiMeta.needsReviewReasons : []),
    ...(clip.reason && clip.reason !== 'ai_producer' && clip.reason !== fullWhy ? [clip.reason] : []),
  ].map((note) => String(note).trim()).filter(Boolean)))
  const layoutChip = clipLayoutChip(aiMeta)
  const clipTypeLabel = clipTypeBadge(aiMeta)
  const people = clipPersonCount(aiMeta)
  const fallbackLabel = clipFallbackPickLabel(aiMeta, clip.reason)
  const displayTitle = clipDisplayTitle({
    title: clip.title,
    reason: clip.reason,
    aiMeta: clip.aiMeta,
    spokenFirstLine: clip.spokenFirstLine,
  })
  const previewEdits: ClipEditsV2 | undefined =
    isStreamer && clip.edits
      ? normalizeEdits(clip.edits, { clipStartMs: clip.startMs, clipEndMs: clip.endMs })
      : undefined

  const editorHref = isStreamer
    ? `/app/video-editor/${projectId}/studio/${clip.id}`
    : `/app/video-editor/${projectId}/edit/${clip.id}`

  const openEditor = () => {
    router.push(editorHref)
  }

  const renameCard = async () => {
    const title = window.prompt('Clip name', clip.title)?.trim()
    if (!title || title === clip.title) return
    setCardActionBusy(true)
    try {
      await patchClip(clip.id, { title })
      toast.success('Clip renamed')
      onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Rename failed') }
    finally { setCardActionBusy(false) }
  }
  const duplicateCard = async () => {
    setCardActionBusy(true)
    try {
      await clipsFetch(`/api/clips/clips/${encodeURIComponent(clip.id)}/duplicate`, { method: 'POST', body: '{}' })
      toast.success('Duplicate created')
      onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Duplicate failed') }
    finally { setCardActionBusy(false) }
  }
  const copyMomentLink = async () => {
    try {
      const link = await clipsFetch<{ url?: string; preparing?: boolean }>(`/api/clips/clips/${clip.id}/full-video-link`)
      if (!link?.url) return toast.message('Full-video link is not ready yet')
      await navigator.clipboard.writeText(new URL(link.url, window.location.origin).href)
      toast.success('Moment link copied')
    } catch { toast.error('Could not copy moment link') }
  }

  const runDownload = async () => {
    if (!clip.previewUrl && !clip.posterUrl) {
      toast.error('Preview still processing — try again in a moment')
      return
    }
    setDownloadBusy(true)
    try {
      await exportClipDownload(clip.id, { aspect: CLIP_PREVIEW_EXPORT_ASPECT })
      if (onDownload) await onDownload(clip.id)
    } catch {
      /* exportClipDownload surfaces toast */
    } finally {
      setDownloadBusy(false)
    }
  }

  const hideClip = async () => {
    if (!onHidden) return
    setHideBusy(true)
    const tid = toast.loading('Hiding clip…')
    try {
      await clipsFetch(`/api/clips/clips/${clip.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ hidden: true, disliked: true }),
      })
      toast.success('Clip hidden — finding a replacement…', { id: tid })
      onHidden(clip.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not hide clip', { id: tid })
    } finally {
      setHideBusy(false)
    }
  }
  const makeThumbnail = async () => {
    setThumbBusy(true)
    try {
      await clipsFetch(`/api/clips/clips/${clip.id}/thumbnail`, {
        method: 'POST',
        body: JSON.stringify({ aspect: '9:16' }),
      })
      toast.success('Thumbnail generation started — open editor to pick a cover')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thumbnail failed')
    } finally {
      setThumbBusy(false)
    }
  }
  const scores = (clip.scores || {}) as Record<string, string>
  const streamerReasons =
    (clip.aiMeta as { streamer?: { reasons?: { kind: string; label: string; value?: string }[] } })?.streamer
      ?.reasons ?? []
  const showClipperDims =
    !isStreamer && !streamerReasons.length && (scores.hook || scores.flow || scores.value || scores.trend)
  const dims = [
    ['Hook', scores.hook],
    ['Flow', scores.flow],
    ['Value', scores.value],
    ['Trend', scores.trend],
  ] as const
  const reasonTag = clipReasonTag(aiMeta, {
    wps: aiMeta.wordsPerSec ?? 0,
    startMs: clip.startMs,
    endMs: clip.endMs,
  })
  const scoreTooltipLines = clipScoreTooltipLines(clip)
  const ReasonIcon = reasonTag === 'visual' ? Eye : reasonTag === 'both' ? Sparkles : Mic

  return (
    <article
      id={`clip-card-${clip.id}`}
      data-testid="clip-card"
      className={`group flex h-full flex-col gap-2 overflow-hidden rounded-xl border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'
      }`}
    >
      <div
        className={`relative cursor-pointer bg-muted ${clipCardAspectClass(cardAspect)}`}
        role="link"
        tabIndex={0}
        aria-label={`Open ${displayTitle} in editor`}
        onClick={(e) => {
          const t = e.target as HTMLElement
          if (t.closest('button, label, input, a, [data-slot="button"]')) return
          openEditor()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openEditor()
          }
        }}
      >
        {onToggleSelect ? (
          <label
            className="absolute left-2 bottom-2 z-10 flex cursor-pointer items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="size-3.5 accent-primary"
              aria-label={`Select ${displayTitle}`}
            />
            Select
          </label>
        ) : null}
        {clip.previewUrl || clip.posterUrl || clip.fallbackSourceUrl ? (
          <ClipCardVideo
            clipId={clip.id}
            previewUrl={clip.previewUrl}
            posterUrl={clip.posterUrl}
            fallbackSourceUrl={clip.fallbackSourceUrl}
            fallbackStartMs={clip.fallbackStartMs}
            previewEdits={previewEdits}
            overlayBurnedIn={isStreamer}
          />
        ) : null}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="absolute left-2 top-2" title={why ?? undefined}>
                <ScoreRing score={clip.score} display={showClipperDims ? 'letter' : 'numeric'} />
              </div>
            </TooltipTrigger>
            <TooltipContent data-testid="clip-score-tooltip">
              <div className="flex max-w-xs flex-col gap-0.5 text-xs">
                {scoreTooltipLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {onHidden ? (
          <button
            type="button"
            disabled={hideBusy}
            onClick={() => void hideClip()}
            className="absolute right-2 top-2 rounded-md bg-black/55 p-1.5 text-white opacity-0 ring-1 ring-white/20 transition group-hover:opacity-100 focus:opacity-100"
            aria-label="Hide clip"
          >
            <EyeOff className="size-4" aria-hidden />
          </button>
        ) : null}
        <DurationChip ms={clip.durationMs} />
        <span
          data-testid="clip-reason-tag"
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white"
        >
          <ReasonIcon className="size-3" aria-hidden />
          {reasonTagLabel(reasonTag)}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug break-words">
          <Link
            href={editorHref}
            prefetch={false}
            className="text-left hover:text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {displayTitle}
          </Link>
        </h3>
        {clip.spokenFirstLine ? (
          <p className="line-clamp-2 text-xs text-muted-foreground" data-testid="clip-spoken-first-line">
            {clip.spokenFirstLine}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{formatDur(clip.durationMs)} clip</span>
          {' · '}
          Source {formatTimecode(clip.startMs)}–{formatTimecode(clip.endMs)} · score {clip.score}
        </p>
        {(() => {
          const meta = (clip.aiMeta as { streamer?: { meta?: { game?: string; vodUrlAt?: string } } })?.streamer?.meta
          if (!meta?.game && !meta?.vodUrlAt) return null
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {meta.game ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{meta.game}</span>
              ) : null}
              {meta.vodUrlAt ? (
                <a href={meta.vodUrlAt} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  VOD {formatTimecode(clip.startMs)} ↗
                </a>
              ) : null}
            </div>
          )
        })()}
        <div className="flex flex-wrap gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                  Score {clip.score}
                </span>
              </TooltipTrigger>
              <TooltipContent data-testid="clip-score-tooltip">
                <div className="flex max-w-xs flex-col gap-0.5 text-xs">
                  {scoreTooltipLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <NeedsReviewBadge aiMeta={clip.aiMeta} />
          {fallbackLabel ? (
            <span
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200"
              title="Lower-confidence moment — you can still preview, edit, and export"
            >
              {fallbackLabel}
            </span>
          ) : null}
          {clipTypeLabel ? (
            <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {clipTypeLabel}
            </span>
          ) : null}
          {layoutChip ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {layoutChip}
            </span>
          ) : null}
          {people != null && people >= 1 ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {people === 1 ? '1 person' : `${people} people`}
            </span>
          ) : null}
          {showClipperDims
            ? dims.map(([label, grade]) => (
                <span
                  key={label}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {label} {grade ?? '—'}
                </span>
              ))
            : null}
        </div>
        {shortWhy ? (
          <p className="line-clamp-1 text-xs text-muted-foreground" data-testid="clip-why-line">{shortWhy}</p>
        ) : null}
        {(detailNotes.length > 0 || !isStreamer || streamerReasons.length > 0) ? (
          <details className="text-xs text-muted-foreground" data-testid="clip-card-details">
            <summary className="cursor-pointer select-none font-medium text-foreground/80 hover:text-foreground">Details</summary>
            <div className="mt-2 space-y-2">
              {detailNotes.length ? (
                <ul className="space-y-1 pl-4">
                  {detailNotes.map((note) => <li key={note} className="list-disc">{note}</li>)}
                </ul>
              ) : null}
              {!isStreamer ? <ClipPostCopy clipId={clip.id} aiMeta={clip.aiMeta} /> : null}
              <ReasonChips score={isStreamer ? clip.score : undefined} reasons={streamerReasons} />
              {isStreamer && !streamerReasons.length ? (
                <p className="text-[10px] text-muted-foreground">No signal chips (chat or replay may be unavailable).</p>
              ) : null}
            </div>
          </details>
        ) : null}
        <div className="mt-auto flex flex-nowrap items-center gap-1.5 pt-1" data-testid="clip-card-actions">
          <Button
            size="sm"
            variant="default"
            className="h-8 shrink-0"
            render={<Link href={editorHref} prefetch={false} />}
            onClick={(e) => e.stopPropagation()}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            disabled={downloadBusy || (!clip.previewUrl && !clip.posterUrl)}
            title={!clip.previewUrl && !clip.posterUrl ? 'Preview still processing' : undefined}
            onClick={(e) => {
              e.stopPropagation()
              void runDownload()
            }}
          >
            {downloadBusy ? 'Exporting…' : 'Download'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 p-0"
                  aria-label="More actions"
                  data-testid="clip-card-more"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid="clip-card-text-editor" onClick={() => { console.info('[editor:text] card-entry', { projectId, clipId: clip.id }); router.push('/app/video-editor/' + projectId + '/text/' + clip.id + (isStreamer ? '?from=studio' : '')) }}>Text editor</DropdownMenuItem>
              <DropdownMenuItem data-testid="clip-card-story-editor" onClick={() => {
                console.log('[editor:story-mode] card-entry', { projectId, clipId: clip.id })
                router.push(routes.story(projectId, clip.id, isStreamer ? { from: 'studio' } : undefined))
              }}>Story blocks</DropdownMenuItem>
              <DropdownMenuItem data-testid="clip-card-templates-editor" onClick={() => {
                console.info('[editor:templates-mode] card-entry', { projectId, clipId: clip.id })
                router.push(routes.templateMode(projectId, clip.id, isStreamer ? { from: 'studio' } : undefined))
              }}>Templates</DropdownMenuItem>
              <DropdownMenuItem disabled={cardActionBusy} data-testid="clip-card-rename" onClick={() => void renameCard()}>Rename</DropdownMenuItem>
              <DropdownMenuItem disabled={cardActionBusy} data-testid="clip-card-duplicate" onClick={() => void duplicateCard()}>Duplicate</DropdownMenuItem>
              {projectHasUpload ? <DropdownMenuItem data-testid="clip-card-copy-moment" onClick={() => void copyMomentLink()}>Copy moment link</DropdownMenuItem> : null}
              <DropdownMenuItem disabled={thumbBusy} onClick={() => void makeThumbnail()}>
                Make thumbnail
              </DropdownMenuItem>
              {projectHasUpload ? (
                <DropdownMenuItem
                  data-testid="open-in-full-video"
                  disabled={openFull.loading}
                  onClick={() => openFull.open()}
                >
                  {openFull.loading ? openFull.progress || 'Preparing full video…' : 'Open in full video'}
                </DropdownMenuItem>
              ) : null}
              {isScriptEditorEnabled() ? (
                <DropdownMenuItem
                  data-testid="edit-in-script-editor"
                  onClick={() => router.push(`/app/video-editor/${projectId}/script?clipId=${clip.id}`)}
                >
                  Script editor
                </DropdownMenuItem>
              ) : null}
              {onHidden ? (
                <DropdownMenuItem disabled={hideBusy} onClick={() => void hideClip()}>
                  <ThumbsDown className="mr-1 size-3.5" aria-hidden />
                  Not for me
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  )
}
