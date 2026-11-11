'use client'

import { MulticamReviewPanel } from '@/components/clips/editor/multicam-review-panel'
import { MulticamSegmentLayoutControls } from '@/components/clips/editor/multicam-segment-layout-controls'
import { FreeToolBadge } from '@/components/clips/ui/free-tool-badge'
import { useMemo, useRef, useState } from 'react'
import { AudioLines, Film, Image as ImageIcon, Plus, RefreshCw, Upload, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatTimecode } from '@/lib/clips/format'
import { Button } from '@/components/ui/button'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import { sourceSegmentTarget } from '@/lib/clips/editor/keyframes'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { MEDIA_ACCEPT, type ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { speakerDisplayName } from '@/lib/clips/editor/transcript-edit'
import type { SourceWord } from '@/lib/clips/source-words'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { MEDIA_DND_TYPE, mediaLanesFor, type MediaDropLane, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import {
  applyMulticamSegments,
  autoMapSpeakersToAngles,
  fillActiveSpeakerGaps,
  multicamSpeakerRows,
  patchSourceSegment,
  replaceSourceSegmentMedia,
  moveSourceSegmentBoundary,
  pruneSources,
  removeSourceSegment,
  segmentAudio,
  sourceById,
  speakersInWords,
  upsertSource,
  type ClipMulticam,
  type SourceAudio,
} from '@/lib/clips/editor/sources'
import { insertMediaAt, sourceFromItem, type InsertMode } from '@/lib/clips/editor/media-add'
import { TimelineFilmstrip } from '@/components/clips/editor/timeline/timeline-filmstrip'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import { MediaTranscribeControl } from '@/components/clips/editor/media-transcribe-control'
import { InsertsSection } from '@/components/clips/editor/media-inserts-section'
import { SpeechSearchSection } from '@/components/clips/editor/speech-search-section'
import { ProjectSelectsBin, useProjectSelectsActions } from '@/components/clips/editor/project-selects-bin'
import { SourceMonitor, type MonitorRequest } from '@/components/clips/editor/source-monitor'
import type { Timebase } from '@/lib/clips/editor/clip-timeline'
import { corsMediaProps } from '@/components/clips/editor/g4/media-cors'
import { MAIN_ANGLE, SYNC_NUDGE_MS, multicamAngles, nudgeSync, resetSync } from '@/lib/clips/editor/multicam-manual'

const LANE_LABEL: Record<MediaDropLane, string> = { video: 'Video', broll: 'B-roll', music: 'Music', sfx: 'SFX' }
/** 'visual' = video + images (B-roll Upload tab). */
type Filter = 'all' | 'video' | 'image' | 'audio' | 'visual'

function dur(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return ''
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function MediaThumb({ item, className = 'h-16 w-full' }: { item: ProjectMediaItem; className?: string }) {
  if (item.mediaType === 'image' && item.url) {
    return <img {...corsMediaProps(item.url)} src={item.url} alt="" className={`${className} rounded object-cover`} draggable={false} />
  }
  if (item.mediaType === 'video' && item.url) {
    // Poster frame straight from the signed URL (metadata + first frame only).
    return <video {...corsMediaProps(item.url)} src={`${item.url}#t=0.1`} muted playsInline preload="metadata" className={`${className} rounded bg-black object-cover`} />
  }
  return (
    <div className={`${className} flex items-center justify-center rounded bg-muted text-muted-foreground`}>
      {item.mediaType === 'audio' ? <AudioLines className="size-5" /> : <Film className="size-5" />}
    </div>
  )
}

/** Library grid shared by the Media panel and the B-roll "Upload" tab. */
export function MediaLibraryGrid({
  media,
  filter = 'all',
  lanes,
  onAdd,
  onReplaceSelected,
  canReplace = false,
  onUseForSlot,
  canUseForSlot = false,
  compact = false,
  onInsert,
}: {
  media: ProjectMediaApi
  filter?: Filter
  /** Lanes offered on each card (default: every lane the media fits). */
  lanes?: MediaDropLane[]
  onAdd: (item: ProjectMediaItem, lane: MediaDropLane) => void
  onReplaceSelected?: (item: ProjectMediaItem) => void
  canReplace?: boolean
  /** B3B: replace the selected real source-slot item, preserving its stable timeline id. */
  onUseForSlot?: (item: ProjectMediaItem) => void
  canUseForSlot?: boolean
  compact?: boolean
  /** E5b: insert at the playhead / append at the end (lengthens the video). */
  onInsert?: (item: ProjectMediaItem, mode: InsertMode) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const shown = media.items.filter((i) =>
    filter === 'all' ? true : filter === 'visual' ? i.mediaType !== 'audio' : i.mediaType === filter,
  )
  const accept = filter === 'all' ? MEDIA_ACCEPT : filter === 'visual' ? 'video/*,image/*' : `${filter}/*`
  const pick = (files: FileList | null) => {
    if (files?.length) void media.uploadFiles([...files])
  }
  return (
    <div className="flex flex-col gap-2" data-testid="media-library">
      <div
        className={`flex flex-col items-center gap-1 rounded-md border border-dashed p-3 text-center text-xs ${over ? 'border-primary bg-primary/5' : 'border-border'}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          pick(e.dataTransfer.files)
        }}
        data-testid="media-dropzone"
      >
        <Upload className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">Drop video, images or audio</span>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} data-testid="media-upload-button">
          Upload
        </Button>
        <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }} />
      </div>
      {media.uploads.map((u) => (
        <div key={u.key} className="flex items-center gap-2 rounded border p-2 text-xs" data-testid="media-upload-row">
          <span className="min-w-0 flex-1 truncate">{u.filename}</span>
          {u.state === 'error' ? (
            <>
              <span className="text-destructive">{u.error}</span>
              <Button size="sm" variant="ghost" onClick={() => media.dismissUpload(u.key)} aria-label="Dismiss"><X className="size-3" /></Button>
            </>
          ) : (
            <span className="tabular-nums text-muted-foreground">{u.state === 'finalizing' ? 'Finishing…' : `${u.percent}%`}</span>
          )}
        </div>
      ))}
      {media.error ? <p className="text-xs text-destructive">{media.error}</p> : null}
      {!shown.length && !media.loading ? (
        <p className="text-xs text-muted-foreground">No media yet. Uploads are stored with this project.</p>
      ) : null}
      <ul className="grid grid-cols-2 gap-2">
        {shown.map((item) => {
          const fits = (lanes ?? mediaLanesFor(item)).filter((l) => mediaLanesFor(item).includes(l))
          return (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded border p-1.5 text-[11px]"
              draggable={fits.length > 0}
              onDragStart={(e) => {
                e.dataTransfer.setData(MEDIA_DND_TYPE, item.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              data-testid="media-item"
              data-media-type={item.mediaType}
            >
              <div className="relative">
                <MediaThumb item={item} className={compact ? 'h-12 w-full' : undefined} />
                {item.durationMs ? (
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[11px] text-white">{dur(item.durationMs)}</span>
                ) : null}
                {item.ref === 'take' || item.syncMs != null ? (
                  <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[11px] text-white" title="Synced to the main video">
                    {item.isMain ? 'Main' : item.syncStatus === 'clock' ? 'Rooms sync' : item.syncStatus === 'low_confidence' ? 'Sync ?' : 'Synced'}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {item.mediaType === 'image' ? <ImageIcon className="size-3 shrink-0" /> : item.mediaType === 'audio' ? <AudioLines className="size-3 shrink-0" /> : <Video className="size-3 shrink-0" />}
                <span className="min-w-0 flex-1 truncate" title={item.label}>{item.label}</span>
                {item.ref === 'upload' ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${item.label} from project media`}
                    onClick={() => void media.remove(item.id).catch((e) => toast.error(e instanceof Error ? e.message : 'Remove failed'))}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {fits.map((lane) => (
                  <Button key={lane} size="xs" variant="outline" className="h-6 px-1.5 text-[11px]" onClick={() => onAdd(item, lane)} data-testid={`media-add-${lane}`}>
                    <Plus className="size-3" />
                    {LANE_LABEL[lane]}
                  </Button>
                ))}
                {canReplace && onReplaceSelected && fits.includes('video') ? (
                  <Button size="xs" variant="secondary" className="h-6 px-1.5 text-[11px]" onClick={() => onReplaceSelected(item)} data-testid="media-use-for-selected">
                    Use for selected
                  </Button>
                ) : null}
                {canUseForSlot && onUseForSlot && fits.includes('video') ? (
                  <Button size="xs" variant="secondary" className="h-6 px-1.5 text-[11px]" onClick={() => onUseForSlot(item)} data-testid="media-use-for-slot">
                    Use for slot
                  </Button>
                ) : null}
                {onInsert && fits.includes('video') ? (
                  <>
                    <Button size="xs" variant="secondary" className="h-6 px-1.5 text-[11px]" onClick={() => onInsert(item, 'insert')} title="Insert at the playhead — everything after it moves right" data-testid="media-insert">
                      Insert
                    </Button>
                    <Button size="xs" variant="secondary" className="h-6 px-1.5 text-[11px]" onClick={() => onInsert(item, 'append')} title="Add to the end of the clip" data-testid="media-append">
                      Append
                    </Button>
                  </>
                ) : null}
                <MediaTranscribeControl media={media} item={item} />
                {item.ref === 'upload' && item.mediaType === 'video' ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-6 px-1.5 text-[11px]"
                    disabled={item.syncStatus === 'queued'}
                    onClick={() => void media.syncAudio(item.id).catch((e) => toast.error(e instanceof Error ? e.message : 'Sync failed'))}
                    title="Line this angle up with the main video by its audio"
                    data-testid="media-sync-audio"
                  >
                    <RefreshCw className={`size-3 ${item.syncStatus === 'queued' ? 'animate-spin' : ''}`} />
                    {item.syncStatus === 'queued' ? 'Syncing…' : item.syncMs != null ? 'Re-sync' : 'Sync by audio'}
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const AUDIO_LABEL: Record<SourceAudio, string> = { main: 'Main', source: 'Clip', mix: 'Both' }

export function MediaPanel({
  projectId,
  media,
  edits,
  words,
  shots = [],
  selectedVideo,
  selectedSegmentId,
  onSelectSegment,
  onAdd,
  onReplaceSelected,
  onEdits,
  onEditsPass,
  playheadSourceMs,
  onSeekSource,
  monitorRequest = null,
  timebase,
  playheadOutMs = 0,
  playheadOutMsRef,
  sourceDurationMs,
}: {
  projectId: string
  media: ProjectMediaApi
  edits: ClipEditsV2
  words: SourceWord[]
  shots?: CropShot[]
  selectedVideo: { srcInMs: number; srcOutMs: number } | null
  selectedSegmentId: string | null
  onSelectSegment: (id: string | null) => void
  onAdd: (item: ProjectMediaItem, lane: MediaDropLane) => void
  onReplaceSelected: (item: ProjectMediaItem) => void
  onEdits: (next: ClipEditsV2) => void
  /** One named undo step (e.g. multicam auto-switch). */
  onEditsPass?: (next: ClipEditsV2, label: string) => void
  playheadSourceMs: number
  onSeekSource: (sourceMs: number) => void
  /** G1c: match frame / open request for the source monitor. */
  monitorRequest?: MonitorRequest | null
  /** G1c: the timeline's time base + playhead (output ms) for Insert / Overwrite. */
  timebase?: Timebase
  playheadOutMs?: number
  playheadOutMsRef?: import('react').MutableRefObject<number>
  sourceDurationMs?: number
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectsTick, setSelectsTick] = useState(0)
  const addToSelects = useProjectSelectsActions(projectId, () => setSelectsTick((n) => n + 1))
  const seg = edits.sourceSegments?.find((s) => s.id === selectedSegmentId) ?? null
  const segSource = seg ? sourceById(edits.sources, seg.sourceId) : undefined

  const angles = useMemo(
    () =>
      media.items.filter(
        (i) =>
          !i.isMain &&
          ((i.mediaType === 'video' && (i.ref === 'take' || i.syncMs != null)) || i.mediaType === 'image' || i.mediaType === 'audio'),
      ),
    [media.items],
  )
  const angleLibrary = useMemo(() => angles.map(sourceFromItem), [angles])
  const mainItem = media.items.find((i) => i.isMain)
  const speakerRows = useMemo(
    () => multicamSpeakerRows(words, shots, edits.trim.in, edits.trim.out),
    [words, shots, edits.trim.in, edits.trim.out],
  )
  const mc: ClipMulticam = edits.multicam ?? {}
  const autoCount = edits.sourceSegments?.filter((s) => s.auto).length ?? 0

  const replaceSlot = (item: ProjectMediaItem) => {
    if (!seg || item.mediaType === 'audio') return
    onEdits(replaceSourceSegmentMedia(edits, seg.id, sourceFromItem(item)))
  }
  const moveIncomingCut = (deltaMs: number) => {
    if (!seg) return
    const ordered = [...(edits.sourceSegments ?? [])].sort((a, b) => a.startMs - b.startMs)
    const index = ordered.findIndex((row) => row.id === seg.id)
    if (index <= 0) return
    onEdits(moveSourceSegmentBoundary(edits, ordered[index - 1]!.id, seg.id, seg.startMs + deltaMs))
  }

  const patchSeg = (patch: Parameters<typeof patchSourceSegment>[2]) => {
    if (!seg) return
    onEdits({ ...edits, sourceSegments: patchSourceSegment(edits.sourceSegments, seg.id, patch, edits.sources) })
  }
  const removeSeg = () => {
    if (!seg) return
    const sourceSegments = removeSourceSegment(edits.sourceSegments, seg.id)
    onEdits({ ...edits, sourceSegments, sources: pruneSources(edits.sources, sourceSegments, edits.multicam, edits.inserts) })
    onSelectSegment(null)
  }

  const setSpeaker = (spk: string, value: string) => {
    let sources = edits.sources
    if (value !== 'main') {
      const it = media.items.find((a) => a.refId === value && !a.isMain)
      if (it) sources = upsertSource(sources, sourceFromItem(it)).sources
    }
    const map = { ...(mc.speakerSources ?? {}), [spk]: value }
    onEdits({ ...edits, sources, multicam: { ...mc, speakerSources: map } })
  }

  const fillGaps = () => {
    let sources = edits.sources
    for (const a of angles) {
      if (a.mediaType !== 'video') continue
      const own = sources?.find((s) => s.id === a.refId)
      if (own && own.syncMs === undefined) sources = upsertSource(sources, sourceFromItem(a)).sources
    }
    const speakerIds = speakerRows.map((r) => r.id)
    const angleIds = angles.filter((a) => a.mediaType === 'video').map((a) => a.refId)
    let base = { ...edits, sources }
    base = autoMapSpeakersToAngles(base, speakerIds, angleIds)
    for (const refId of new Set(Object.values(base.multicam?.speakerSources ?? {}))) {
      if (!refId || refId === 'main') continue
      const it = angles.find((a) => a.refId === refId)
      if (it) sources = upsertSource(sources, sourceFromItem(it)).sources
    }
    const { edits: next, generated } = fillActiveSpeakerGaps(
      { ...base, sources },
      words,
      edits.trim.in,
      edits.trim.out,
      shots,
    )
    if (onEditsPass) onEditsPass(next, 'Auto camera cuts')
    else onEdits(next)
    if (generated.length) {
      toast.success(`${generated.length} auto cut${generated.length === 1 ? '' : 's'} in open gaps`)
    } else if (!angleIds.length) {
      toast.message('Add synced video angles in the library before auto-switch.')
    } else {
      toast.message('No open gaps for auto cuts — manual switches unchanged.')
    }
  }
  const onInsert = (item: ProjectMediaItem, mode: InsertMode) => {
    const res = insertMediaAt(edits, item, playheadSourceMs, mode, () => crypto.randomUUID())
    if (!res.edits) {
      toast.message(res.message)
      return
    }
    onEdits(res.edits)
    if (res.message) toast.message(res.message)
  }

  const clearAuto = () => {
    const sourceSegments = applyMulticamSegments(edits.sourceSegments, [], edits.trim.in, edits.trim.out, edits.sources)
    onEdits({ ...edits, sourceSegments })
  }

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="media-panel">
      <SpeechSearchSection
        projectId={projectId}
        edits={edits}
        media={media}
        playheadSourceMs={playheadSourceMs}
        onSeekSource={onSeekSource}
        onEdits={onEdits}
        onAddToSelects={addToSelects}
      />
      <ProjectSelectsBin
        key={selectsTick}
        projectId={projectId}
        edits={edits}
        mediaItems={media.items}
        sourceDurationMs={sourceDurationMs}
        onAssemble={(next, label) => {
          if (onEditsPass) onEditsPass(next, label)
          else onEdits(next)
        }}
      />
      <MulticamSegmentLayoutControls
        edits={edits}
        library={angleLibrary}
        playheadSourceMs={playheadSourceMs}
        onEdits={onEdits}
        onEditsPass={onEditsPass}
      />
      {seg ? (
        <section className="space-y-2 rounded-md border p-2" data-testid="media-segment-editor">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{segSource?.label ?? 'Source'} on Video</span>
            <Button size="xs" variant="ghost" onClick={() => onSelectSegment(null)} aria-label="Close">
              <X className="size-3" />
            </Button>
          </div>
          {segSource?.mediaType === 'video' ? (
            <>
              <div className="flex items-center gap-1" role="group" aria-label="Sound in this segment">
                <Label className="w-12 text-[11px]">Sound</Label>
                {(['main', 'source', 'mix'] as const).map((m) => (
                  <Button key={m} size="xs" variant={segmentAudio(seg, segSource) === m ? 'default' : 'outline'} onClick={() => patchSeg({ audio: m })} data-testid={`media-seg-audio-${m}`}>
                    {AUDIO_LABEL[m]}
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-12">Speed</span>
                <Input
                  type="number"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={seg.speed ?? 1}
                  className="h-7 w-24 px-2 text-xs"
                  data-testid="media-seg-speed"
                  onChange={(event) => {
                    const value = Number(event.currentTarget.value)
                    if (!Number.isFinite(value) || value < 0.25 || value > 4) return
                    patchSeg({ speed: value })
                  }}
                />
                <span>×</span>
              </label>
            </>
          ) : null}
          <div className="flex items-center gap-1" role="group" aria-label="Framing">
            <Label className="w-12 text-[11px]">Frame</Label>
            {(['cover', 'contain'] as const).map((f) => (
              <Button key={f} size="xs" variant={(seg.fit ?? 'cover') === f ? 'default' : 'outline'} onClick={() => patchSeg({ fit: f })} data-testid={`media-seg-fit-${f}`}>
                {f === 'cover' ? 'Fill' : 'Fit'}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5" data-testid="media-seg-transform-controls">
            <Label className="text-[11px]">Transform</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ['x', 'X %', -100, 100, 0],
                ['y', 'Y %', -100, 100, 0],
                ['scale', 'Scale %', 25, 400, 100],
                ['rotation', 'Rotate °', -360, 360, 0],
                ['cropL', 'Crop L %', 0, 90, 0],
                ['cropT', 'Crop T %', 0, 90, 0],
                ['cropR', 'Crop R %', 0, 90, 0],
                ['cropB', 'Crop B %', 0, 90, 0],
              ] as const).map(([key, label, min, max, identity]) => (
                <label key={key} className="space-y-0.5 text-[10px] text-muted-foreground">
                  <span>{label}</span>
                  <Input
                    type="number"
                    min={min}
                    max={max}
                    step={1}
                    value={seg.transform?.[key] ?? identity}
                    className="h-7 px-2 text-xs"
                    data-testid={`media-seg-transform-${key}`}
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value)
                      if (!Number.isFinite(value)) return
                      patchSeg({ transform: { ...(seg.transform ?? {}), [key]: value } })
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
          {seg ? (
            <div className="space-y-1.5" data-testid="media-seg-motion-keyframes">
              <Label className="text-[11px]">Clip motion</Label>
              <KeyframeInspector
                edits={edits}
                target={sourceSegmentTarget(seg.id)}
                label="Clip motion"
                localMs={Math.max(0, playheadSourceMs - seg.startMs)}
                onCommit={onEdits}
                onSeekLocal={(t) => onSeekSource(seg.startMs + t)}
                props={['x', 'y', 'scale', 'rotation']}
              />
            </div>
          ) : null}
          <div className="space-y-1.5" data-testid="media-seg-fx-controls">
            <Label className="text-[11px]">Slot look</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ['brightness', 'Bright'],
                ['contrast', 'Contrast'],
                ['saturation', 'Saturation'],
              ] as const).map(([key, label]) => (
                <label key={key} className="space-y-0.5 text-[10px] text-muted-foreground">
                  <span>{label}</span>
                  <Input
                    type="number"
                    min={-100}
                    max={100}
                    step={1}
                    value={seg.fx?.[key] ?? 0}
                    className="h-7 px-2 text-xs"
                    data-testid={`media-seg-fx-${key}`}
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value)
                      if (!Number.isFinite(value)) return
                      patchSeg({ fx: { ...(seg.fx ?? {}), [key]: value } })
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="xs" variant="outline" onClick={() => moveIncomingCut(-Math.round(1000 / 30))} data-testid="media-seg-cut-prev-frame">
              Cut −1f
            </Button>
            <Button size="xs" variant="outline" onClick={() => moveIncomingCut(Math.round(1000 / 30))} data-testid="media-seg-cut-next-frame">
              Cut +1f
            </Button>
            <Button size="xs" variant="outline" disabled={playheadSourceMs <= seg.startMs + 100 || playheadSourceMs >= seg.endMs} onClick={() => patchSeg({ endMs: Math.round(playheadSourceMs) })}>
              End at playhead
            </Button>
            <Button size="xs" variant="outline" disabled={playheadSourceMs >= seg.endMs - 100 || playheadSourceMs <= seg.startMs} onClick={() => {
              const shift = Math.round(playheadSourceMs) - seg.startMs
              patchSeg({ startMs: Math.round(playheadSourceMs), ...(seg.inMs !== undefined ? { inMs: seg.inMs + Math.round(shift * (seg.speed ?? 1)) } : {}) })
            }}>
              Start at playhead
            </Button>
            <Button size="xs" variant="destructive" onClick={removeSeg} data-testid="media-seg-remove">Remove</Button>
          </div>
        </section>
      ) : null}

      <div className="flex gap-1 rounded-md border border-border p-1" role="group" aria-label="Media type">
        {(['all', 'video', 'image', 'audio'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'video' ? 'Video' : f === 'image' ? 'Images' : 'Audio'}
          </Button>
        ))}
      </div>
      {timebase ? (
        <SourceMonitor
          items={media.items}
          transcripts={media.transcripts}
          request={monitorRequest}
          edits={edits}
          tb={timebase}
          playheadOutMs={playheadOutMs}
          playheadOutMsRef={playheadOutMsRef}
          onEdits={onEdits}
        />
      ) : null}
      <MediaLibraryGrid media={media} filter={filter} onAdd={onAdd} onReplaceSelected={onReplaceSelected} canReplace={Boolean(selectedVideo)}
        onUseForSlot={replaceSlot} canUseForSlot={Boolean(seg)} onInsert={onInsert} />
      <InsertsSection edits={edits} media={media} onEdits={onEdits} />
      <p className="text-[11px] text-muted-foreground">
        Drag onto a timeline lane or use + Video / B-roll / Music / SFX. Video segments replace the picture of that part of the clip; the transcript and captions stay on the main video unless you transcribe that clip. Insert / Append add footage and lengthen the video.
      </p>

      {angles.length ? (
        <section className="space-y-2 rounded-md border p-2" data-testid="media-multicam">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span>Auto camera cuts</span>
            <FreeToolBadge />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Map speakers to angles, then auto-switch only in gaps — manual cuts (keys 1–9, timeline) stay.
          </p>
          {speakerRows.length ? (
            speakerRows.map(({ id: spk, speakerNum }) => (
              <div key={spk} className="flex items-center gap-2">
                <Label className="w-20 shrink-0 truncate text-[11px]" title={speakerDisplayName(edits.speakerNames, spk, speakerNum)}>
                  {speakerDisplayName(edits.speakerNames, spk, speakerNum)}
                </Label>
                <Select
                  items={[{ value: 'main', label: mainItem ? `${mainItem.label} (main)` : 'Main camera' }, ...angles.map((a) => ({ value: a.refId, label: a.label }))]}
                  value={mc.speakerSources?.[spk] ?? mc.speakerSources?.[spk === 'A' ? '0' : spk === 'B' ? '1' : spk] ?? 'main'}
                  onValueChange={(v) => typeof v === 'string' && setSpeaker(spk, v)}
                >
                  <SelectTrigger size="sm" className="min-w-0 flex-1" data-testid={`multicam-speaker-${spk}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">{mainItem ? `${mainItem.label} (main)` : 'Main camera'}</SelectItem>
                    {angles.map((a) => (
                      <SelectItem key={a.refId} value={a.refId}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-muted-foreground">No speaker labels in this transcript — switch angles per segment with “Use for selected”.</p>
          )}
          <SliderRow label="Min shot" value={(mc.minHoldMs ?? 2000) / 1000} min={2} max={10} step={0.5} unit=" s" testId="multicam-hold"
            onCommit={(v) => onEdits({ ...edits, multicam: { ...mc, minHoldMs: Math.round(v * 1000) } })} />
          <SliderRow label="Wide shot every" value={(mc.wideEveryMs ?? 45_000) / 1000} min={5} max={120} step={5} unit=" s" testId="multicam-wide"
            onCommit={(v) => onEdits({ ...edits, multicam: { ...mc, wideEveryMs: Math.round(v * 1000) } })} />
          <MulticamAudioDefault edits={edits} mc={mc} onEdits={onEdits} />
          <MulticamSyncAll angles={angles} media={media} />
          <ManualAngles edits={edits} angles={angles} mainLabel={mainItem?.label} onEdits={onEdits} />
          <div className="flex flex-wrap gap-1">
            <Button size="sm" onClick={fillGaps} disabled={!speakerRows.length} data-testid="multicam-fill-gaps">
              Auto-switch (fill gaps)
            </Button>
            {autoCount ? (
              <Button size="sm" variant="ghost" onClick={clearAuto} data-testid="multicam-clear-auto">
                Clear {autoCount} auto cut{autoCount === 1 ? '' : 's'}
              </Button>
            ) : null}
          </div>
          {onEditsPass ? (
            <MulticamReviewPanel
              edits={edits}
              angles={angles}
              mainLabel={mainItem?.label}
              onEditsPass={onEditsPass}
              onSeekSource={onSeekSource}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

/**
 * G1b2: manual multicam — angle keys (1–9 on the timeline while playing), sync offset nudge on top
 * of the audio auto-sync, reset to the auto-sync value.
 */
function AngleFilmstripPreview({ item }: { item: ProjectMediaItem | undefined }) {
  const url = item?.mediaType === 'video' ? item.url : item?.mediaType === 'image' ? item.url : null
  const frames = useFilmstripFrames(url)
  if (!item || item.mediaType === 'audio') return null
  if (!url) return <span className="h-8 w-20 shrink-0 rounded bg-muted/40" data-testid="multicam-angle-filmstrip-empty" />
  return (
    <div className="relative h-8 w-24 shrink-0 overflow-hidden rounded border border-border/60" data-testid="multicam-angle-filmstrip">
      <TimelineFilmstrip fromMs={0} toMs={3000} widthPx={96} heightPx={32} pxPerMs={96 / 3000} frames={frames} stillUrl={item.mediaType === 'image' ? url : null} />
    </div>
  )
}

function MulticamAudioDefault({
  edits,
  mc,
  onEdits,
}: {
  edits: ClipEditsV2
  mc: ClipMulticam
  onEdits: (next: ClipEditsV2) => void
}) {
  const value = mc.audioDefault ?? 'main'
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]" data-testid="multicam-audio-default">
      <Label className="shrink-0">Switch audio</Label>
      <Select
        items={[
          { value: 'main', label: 'Main mic' },
          { value: 'source', label: 'Angle mic' },
          { value: 'mix', label: 'Mix' },
        ]}
        value={value}
        onValueChange={(v) => {
          if (v !== 'main' && v !== 'source' && v !== 'mix') return
          onEdits({ ...edits, multicam: { ...mc, audioDefault: v } })
        }}
      >
        <SelectTrigger size="sm" className="h-7 min-w-[7rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="main">Main mic</SelectItem>
          <SelectItem value="source">Angle mic</SelectItem>
          <SelectItem value="mix">Mix</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7"
        data-testid="multicam-audio-apply-all"
        onClick={() => {
          const audio = mc.audioDefault ?? 'main'
          const segs = edits.sourceSegments?.map((s) => ({ ...s, audio }))
          onEdits({ ...edits, multicam: { ...mc, audioDefault: audio }, sourceSegments: segs })
        }}
      >
        Apply to all switches
      </Button>
    </div>
  )
}

function MulticamSyncAll({ angles, media }: { angles: ProjectMediaItem[]; media: ProjectMediaApi }) {
  const [progress, setProgress] = useState<string | null>(null)
  const targets = angles.filter((a) => a.mediaType === 'video')
  if (!targets.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7"
        disabled={Boolean(progress)}
        data-testid="multicam-sync-all"
        onClick={() => {
          void (async () => {
            let i = 0
            for (const item of targets) {
              i += 1
              setProgress(`${i}/${targets.length}`)
              try {
                await media.syncAudio(item.id)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Sync failed')
                break
              }
            }
            setProgress(null)
          })()
        }}
      >
        Sync all angles
      </Button>
      {progress ? <span className="text-[11px] text-muted-foreground">{progress}</span> : null}
    </div>
  )
}

function ManualAngles({
  edits,
  angles,
  mainLabel,
  onEdits,
}: {
  edits: ClipEditsV2
  angles: ProjectMediaItem[]
  mainLabel?: string
  onEdits: (next: ClipEditsV2) => void
}) {
  const library = angles.map(sourceFromItem)
  const list = multicamAngles(edits, library)
  const byRef = new Map(angles.map((a) => [a.refId, a]))
  return (
    <div className="space-y-1 rounded border border-dashed p-1.5" data-testid="multicam-manual">
      <p className="text-[11px] text-muted-foreground">
        Switch by hand: press 1–9 on the timeline (first nine angles), or pick a camera on the clip / transcript.
        {list.length > 9 ? ` Angles 10–${list.length} are menu-only.` : ''}
      </p>
      {list.map((a) => {
        const own = edits.sources?.find((s) => s.id === a.sourceId)
        const lib = library.find((s) => s.id === a.sourceId)
        const off = (own ?? lib)?.syncMs
        const item = a.sourceId === MAIN_ANGLE ? undefined : byRef.get(a.sourceId) ?? byRef.get(own?.refId ?? '')
        return (
          <div key={a.sourceId} className="flex items-center gap-1 text-[11px]" data-testid={`multicam-angle-${a.key}`}>
            <span className="w-4 font-mono">{a.key}</span>
            <AngleFilmstripPreview item={item} />
            <span className="min-w-0 flex-1 truncate">{a.sourceId === MAIN_ANGLE ? (mainLabel ? `${mainLabel} (main)` : 'Main camera') : a.label}</span>
            {a.sourceId !== MAIN_ANGLE ? (
              <>
                <span className="tabular-nums text-muted-foreground" title="Sync offset (angle ms = main ms + offset)">
                  {off != null ? `${off >= 0 ? '+' : ''}${Math.round(off)} ms` : '—'}
                </span>
                <Button size="xs" variant="ghost" className="h-6 px-1" title="Nudge −1 frame" data-testid={`multicam-nudge-minus-${a.key}`}
                  onClick={() => onEdits(nudgeSync(edits, a.sourceId, -SYNC_NUDGE_MS, library))}>−1f</Button>
                <Button size="xs" variant="ghost" className="h-6 px-1" title="Nudge +1 frame" data-testid={`multicam-nudge-plus-${a.key}`}
                  onClick={() => onEdits(nudgeSync(edits, a.sourceId, SYNC_NUDGE_MS, library))}>+1f</Button>
                {own && lib && own.syncMs !== lib.syncMs ? (
                  <Button size="xs" variant="ghost" className="h-6 px-1" title="Back to the audio sync value" onClick={() => onEdits(resetSync(edits, lib))}>
                    Reset
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
