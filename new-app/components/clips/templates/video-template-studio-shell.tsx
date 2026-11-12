'use client'

import Link from 'next/link'
import { useRef, type ComponentProps, type RefObject } from 'react'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { TemplateMusicChoicePanel } from '@/components/clips/templates/template-music-choice-panel'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import type { StudioDraft, StudioSlotFill } from '@/lib/clips/real-video-templates/slot-workflow'
import type { TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { EditorMedia } from '@/lib/server/clips/clip-detail'
import type { UploadProgress } from '@/lib/clips/upload'
import { TemplateTextPanel } from '@/components/clips/templates/template-text-panel'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type MediaItem = {
  asset: TemplateAsset
  label: string
  mime?: string
  durationMs: number | null
  width: number | null
  height: number | null
  url: string | null
  stillUrl?: string | null
  available: boolean
}

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const subtleBtn =
  'rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50'

function thumbUrl(item: MediaItem) {
  return item.stillUrl ?? item.url
}

export function VideoTemplateStudioShell(props: {
  release: VideoTemplateRelease
  project: { id: string; status: string; clipId: string | null } | null
  draft: StudioDraft | null
  progress: { filled: number; total: number }
  ready: boolean
  previewPreparing: boolean
  saveStatus: string
  exportHint: string | null
  busy: boolean
  dirty: boolean
  historyLength: number
  futureLength: number
  canExport: boolean
  slotsRemaining: number
  isMobile: boolean
  mobileStep: 'pick' | 'studio'
  onMobileStep: (step: 'pick' | 'studio') => void
  mobilePick: TemplateAsset[]
  onToggleMobilePick: (asset: TemplateAsset) => void
  onMobileNext: () => void
  undo: () => void
  redo: () => void
  onExportOpen: () => void
  rightTab: 'text' | 'music' | 'style'
  onRightTab: (tab: 'text' | 'music' | 'style') => void
  mediaSearch: string
  onMediaSearch: (value: string) => void
  mediaKind: 'all' | 'video' | 'image' | 'audio' | 'audio'
  onMediaKind: (value: 'all' | 'video' | 'image' | 'audio') => void
  onBrowseMusic: () => void
  media: { items: MediaItem[]; page: number; pages: number; total: number }
  onRefreshMedia: (page: number) => void
  librarySelection: TemplateAsset[]
  onToggleLibrarySelect: (asset: TemplateAsset) => void
  onUpload: (files: File[]) => void
  uploadStatus: UploadProgress | null
  selectedSlot: string
  onSelectSlot: (id: string) => void
  knownMedia: Record<string, MediaItem>
  onAssignAsset: (slotId: string, asset: TemplateAsset) => void
  onBatchFill: () => void
  onBatchFillFiles: (files: File[]) => void
  canBatchFillFromSelection: boolean
  uploadProgress: UploadProgress | null
  onCommitDraft: (value: StudioDraft) => void
  patchFill: (id: string, changes: Partial<StudioSlotFill>) => void
  onCreateHold: (id: string) => void
  activeSlot: VideoTemplateRelease['family']['slots'][number] | undefined
  activeFill: StudioSlotFill | undefined
  clip: {
    clip: { editsSaveVersion: number }
    edits: ClipEditsV2
    mediaUrls: { source: string | null; proxy: string | null; poster: string | null }
    media: EditorMedia | null
    crop: { track: ComponentProps<typeof PreviewStage>['cropTrack'] }
  } | null
  previewReloadEpoch: number
  previewFrameStyle: { aspectRatio: string; maxHeight: number; width: '100%'; maxWidth: number }
  videoRef: RefObject<HTMLVideoElement | null>
  musicAudioRef: RefObject<HTMLAudioElement | null>
  sourceUrls: Record<string, string>
  clockMs: number
  onClockMs: (ms: number) => void
  syncMusicPreview: (outputMs: number, play: boolean) => void
  releaseFamilySlots: VideoTemplateRelease['family']['slots']
  pendingMusic: MediaItem | null
  onPendingMusic: (item: MediaItem | null) => void
  musicMedia: MediaItem | undefined
  musicConfig: NonNullable<ClipEditsV2['audio']>['music'] | null | undefined
}) {
  const {
    release, project, draft, progress, ready, previewPreparing, saveStatus, exportHint, busy,
    historyLength, futureLength, canExport, isMobile, mobileStep, onMobileStep, mobilePick,
    onToggleMobilePick, onMobileNext, undo, redo, onExportOpen, rightTab, onRightTab,
    mediaSearch, onMediaSearch, mediaKind, onMediaKind, onBrowseMusic, media, onRefreshMedia,
    librarySelection, onToggleLibrarySelect, onUpload, uploadStatus, selectedSlot, onSelectSlot,
    knownMedia, onAssignAsset, onBatchFill, onBatchFillFiles, canBatchFillFromSelection,
    uploadProgress, onCommitDraft, patchFill, onCreateHold,
    activeSlot, activeFill, clip, previewReloadEpoch, previewFrameStyle, videoRef, musicAudioRef, sourceUrls,
    clockMs, onClockMs, syncMusicPreview, releaseFamilySlots, pendingMusic, onPendingMusic,
    musicMedia, musicConfig,
  } = props

  const uploadInputRef = useRef<HTMLInputElement>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)

  const editorHref = project?.clipId && project.status === 'READY'
    ? '/app/clips/' + encodeURIComponent(project.id) + '/edit/' + encodeURIComponent(project.clipId)
    : null

  const firstSegmentKey = clip?.edits.sourceSegments?.length
    ? [...clip.edits.sourceSegments].sort((a, b) => a.startMs - b.startMs)[0]?.id ?? 'none'
    : 'none'
  const previewStageKey = project?.clipId
    ? [
        project.clipId,
        clip?.edits.v ?? 0,
        clip?.edits.trim?.in ?? 0,
        clip?.clip.editsSaveVersion ?? 0,
        firstSegmentKey,
        previewReloadEpoch,
      ].join(':')
    : 'idle'

  const previewBlock = ready && clip && project?.clipId ? (
    <>
      <div
        className="relative mx-auto max-h-full w-full overflow-hidden rounded-xl bg-black shadow-lg"
        style={previewFrameStyle}
        data-testid="video-template-preview-frame"
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={e => {
          e.preventDefault()
          const id = e.dataTransfer.getData('text/template-asset-id')
          const item = id ? knownMedia[id]?.asset : undefined
          if (item && activeSlot) onAssignAsset(activeSlot.id, item)
        }}
      >
        <PreviewStage
          key={previewStageKey}
          clipId={project.clipId}
          playheadEpoch={previewReloadEpoch}
          edits={clip.edits}
          videoUrl={clip.mediaUrls.source ?? clip.mediaUrls.proxy}
          posterUrl={clip.mediaUrls.poster}
          media={clip.media}
          cropTrack={clip.crop.track}
          words={[]}
          videoRef={videoRef}
          sourceUrls={sourceUrls}
          onTick={tick => {
            syncMusicPreview(tick.outputMs, videoRef.current?.paused === false)
            onClockMs(tick.outputMs)
          }}
        />
      </div>
      {musicMedia?.url && musicConfig ? (
        <audio
          ref={musicAudioRef}
          src={musicMedia.url}
          preload="auto"
          aria-label="Template soundtrack preview"
          onLoadedMetadata={() => syncMusicPreview(clockMs, videoRef.current?.paused === false)}
          className="hidden"
        />
      ) : null}
      <div className="mt-3 flex items-center gap-3 px-1">
        <button type="button" className={subtleBtn} onClick={() => {
          void videoRef.current?.play()
          syncMusicPreview(clockMs, true)
        }}>Play</button>
        <button type="button" className={subtleBtn} onClick={() => {
          videoRef.current?.pause()
          syncMusicPreview(clockMs, false)
        }}>Pause</button>
        <input
          aria-label="Seek template preview"
          type="range"
          className="min-w-0 flex-1"
          min={0}
          max={clip.edits.trim?.out ?? release.family.totalFrames * 1000 / 30}
          value={Math.min(clockMs, clip.edits.trim?.out ?? release.family.totalFrames * 1000 / 30)}
          onChange={e => {
            const nextMs = Number(e.target.value)
            if (videoRef.current) videoRef.current.currentTime = nextMs / 1000
            syncMusicPreview(nextMs, videoRef.current?.paused === false)
          }}
        />
        <span className="text-xs tabular-nums text-muted-foreground">{(clockMs / 1000).toFixed(1)}s</span>
      </div>
    </>
  ) : (
    <MotionStillPreview
      activeSlot={activeSlot}
      activeFill={activeFill}
      knownMedia={knownMedia}
      previewPreparing={previewPreparing}
      projectStatus={project?.status}
      previewFrameStyle={previewFrameStyle}
    />
  )

  const filmstrip = (
    <div className="border-t bg-card px-3 py-3" data-testid="template-slot-filmstrip">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium" role="status">
          {progress.filled} / {progress.total} slots filled
        </span>
        <button
          type="button"
          className={subtleBtn}
          disabled={!draft || busy}
          onClick={() => (canBatchFillFromSelection ? onBatchFill() : batchInputRef.current?.click())}
          aria-label="Batch fill"
        >
          Batch fill
        </button>
        <input
          ref={batchInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          disabled={busy}
          onChange={e => {
            const chosen = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (chosen.length) onBatchFillFiles(chosen)
          }}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Select a template slot">
        {releaseFamilySlots.map(slot => {
          const fill = draft?.slots[slot.id]
          const mediaItem = fill ? knownMedia[fill.asset.id] : undefined
          const thumb = mediaItem ? thumbUrl(mediaItem) : null
          const secs = (slot.durationFrames / release.family.fps).toFixed(1)
          return (
            <button
              key={slot.id}
              type="button"
              aria-pressed={selectedSlot === slot.id}
              className={
                'relative h-20 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border text-left ' +
                (selectedSlot === slot.id ? 'border-primary ring-2 ring-primary/40' : 'border-border')
              }
              onClick={() => onSelectSlot(slot.id)}
              onDragOver={e => { e.preventDefault() }}
              onDrop={e => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/template-asset-id')
                const item = id ? knownMedia[id]?.asset : undefined
                if (item) onAssignAsset(slot.id, item)
              }}
            >
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="grid h-full place-items-center bg-muted/60 text-[10px] text-muted-foreground">Empty</div>
              )}
              <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[10px] font-semibold text-white">{slot.ordinal}</span>
              <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 text-[9px] text-white">{secs}s</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const mediaGrid = (
    <div className="grid grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-2" aria-label="Workspace media">
      {media.items.map(item => {
        const selected = librarySelection.some(a => a.id === item.asset.id)
        const thumb = thumbUrl(item)
        return (
          <button
            key={item.asset.id}
            type="button"
            disabled={!item.available || busy}
            aria-label={'Use ' + item.label}
            draggable={item.available}
            onDragStart={e => {
              e.dataTransfer.setData('text/template-asset-id', item.asset.id)
              e.dataTransfer.setData('text/template-asset-kind', item.asset.kind)
            }}
            onClick={e => {
              if (isMobile && mobileStep === 'pick' && item.asset.kind !== 'audio') {
                onToggleMobilePick(item.asset)
                return
              }
              if (item.asset.kind === 'audio') {
                onPendingMusic(item)
                return
              }
              if (e.metaKey || e.ctrlKey) {
                onToggleLibrarySelect(item.asset)
                return
              }
              onAssignAsset(selectedSlot, item.asset)
            }}
            className={
              'overflow-hidden rounded-lg border text-left ' +
              (selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50')
            }
          >
            <div className="relative aspect-square bg-muted">
              {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : (
                <div className="grid h-full place-items-center text-[10px] text-muted-foreground">No preview</div>
              )}
            </div>
            <p className="truncate px-1.5 py-1 text-[11px] font-medium">{item.label}</p>
          </button>
        )
      })}
    </div>
  )

  if (isMobile && mobileStep === 'pick') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="video-template-studio-mobile-pick">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <Link href="/app/clips/video-templates" className="text-sm text-muted-foreground">Back</Link>
          <h1 className="text-sm font-semibold">Select {progress.total} clips</h1>
          <Button type="button" size="sm" disabled={!mobilePick.length} onClick={onMobileNext}>Next</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{mediaGrid}</div>
        <h2 className="flex gap-2 overflow-x-auto border-t px-3 py-2 text-xs" role="group" aria-label="Select a template slot">
          {releaseFamilySlots.map(slot => (
            <span key={slot.id} className="shrink-0 rounded border px-2 py-1">
              {slot.ordinal} · {(slot.durationFrames / release.family.fps).toFixed(1)}s
            </span>
          ))}
        </h2>
      </div>
    )
  }

  return (
    <div
      className={
        (isMobile ? 'fixed inset-0 z-40 flex flex-col ' : 'flex h-[calc(100dvh-3rem)] min-h-[560px] flex-col ') +
        'bg-background'
      }
      data-testid="video-template-studio"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
        <Link href="/app/clips/video-templates" className="hidden text-xs text-muted-foreground hover:underline md:inline">
          Templates
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{release.title}</h1>
        <span className="hidden text-xs text-muted-foreground md:inline" role="status">{saveStatus}</span>
        <button type="button" className={subtleBtn} disabled={!historyLength || busy} onClick={undo} aria-label="Undo template change">Undo</button>
        <button type="button" className={subtleBtn} disabled={!futureLength || busy} onClick={redo} aria-label="Redo template change">Redo</button>
        {editorHref ? (
          <Link href={editorHref} className={subtleBtn + ' hidden md:inline-flex'}>Open in editor</Link>
        ) : (
          <span className="hidden text-xs text-muted-foreground md:inline">Open in editor</span>
        )}
        <Button type="button" className="shrink-0" disabled={busy} onClick={onExportOpen} aria-label="Export video">
          Export
        </Button>
      </header>
      {exportHint ? (
        <p className="shrink-0 border-b bg-muted/30 px-4 py-1.5 text-center text-xs text-muted-foreground" role="status">
          {exportHint}
        </p>
      ) : null}
      {!isMobile ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(260px,300px)] grid-rows-[1fr_auto] overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r">
            <div className="space-y-2 border-b p-3">
              <button
                type="button"
                className="block w-full cursor-pointer rounded-lg border border-dashed border-primary/40 px-3 py-2 text-center text-xs font-medium hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => uploadInputRef.current?.click()}
              >
                Upload photos or videos
              </button>
              <input
                ref={uploadInputRef}
                className="sr-only"
                type="file"
                accept="image/*,video/*"
                multiple
                tabIndex={-1}
                aria-hidden
                disabled={busy}
                onChange={e => {
                  const chosen = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  onUpload(chosen)
                }}
              />
              {uploadStatus || uploadProgress ? (
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                  {uploadProgress
                    ? (uploadProgress.state === 'finalizing' ? 'Finalizing ' : 'Uploading ')
                      + (uploadProgress.filename || 'file') + '… ' + Math.round(uploadProgress.percent) + '%'
                    : uploadStatus
                      ? uploadStatus.state + (uploadStatus.percent != null ? ' · ' + Math.round(uploadStatus.percent) + '%' : '')
                      : null}
                </p>
              ) : null}
              <input
                id="video-template-media-search"
                className={inputClass}
                placeholder="Search media"
                value={mediaSearch}
                onChange={e => onMediaSearch(e.target.value)}
                aria-label="Search media"
              />
              <div className="flex gap-1 text-xs" role="tablist" aria-label="Media type">
                {(['all', 'image', 'video'] as const).map(kind => (
                  <button
                    key={kind}
                    type="button"
                    role="tab"
                    aria-selected={mediaKind === kind}
                    className={'flex-1 rounded-md border px-2 py-1 capitalize ' + (mediaKind === kind ? 'border-primary bg-primary/10' : 'border-border')}
                    onClick={() => onMediaKind(kind)}
                  >
                    {kind === 'all' ? 'All' : kind === 'image' ? 'Photos' : 'Videos'}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{mediaGrid}</div>
            <div className="flex items-center justify-between border-t p-2 text-xs">
              <button type="button" className={subtleBtn} disabled={media.page === 1} onClick={() => onRefreshMedia(media.page - 1)}>Prev</button>
              <span>{media.page}/{media.pages}</span>
              <button type="button" className={subtleBtn} disabled={media.page >= media.pages} onClick={() => onRefreshMedia(media.page + 1)}>Next</button>
            </div>
          </aside>
          <main className="flex min-h-0 flex-col overflow-hidden p-4">
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border bg-muted/20 p-3">
              {previewPreparing ? (
                <p className="absolute left-3 top-3 z-10 rounded-full bg-background/90 px-2 py-1 text-xs" role="status">Updating preview…</p>
              ) : null}
              {previewBlock}
            </div>
          </main>
          <aside className="flex min-h-0 flex-col border-l">
            <Tabs value={rightTab} onValueChange={v => onRightTab(v as typeof rightTab)} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="m-2 w-auto justify-start">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="music">Music</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <TabsContent value="text" className="mt-0 space-y-3">
                  {draft ? (
                    <TemplateTextPanel release={release} draft={draft} onCommitDraft={onCommitDraft} />
                  ) : (
                    <p className="text-xs text-muted-foreground">Start a project to edit text.</p>
                  )}
                </TabsContent>
                <TabsContent value="music" className="mt-0 space-y-3 text-xs">
                  {release.design.musicPolicy === 'none' ? (
                    <p className="text-muted-foreground">This template has no music track.</p>
                  ) : (
                    <>
                      <button type="button" className={subtleBtn} onClick={onBrowseMusic}>Swap music</button>
                      {draft?.music ? <p className="text-muted-foreground">Current: {knownMedia[draft.music.id]?.label ?? 'Soundtrack'}</p> : null}
                      {pendingMusic && draft ? (
                        <TemplateMusicChoicePanel
                          key={pendingMusic.asset.id}
                          family={release.family}
                          musicUploadId={pendingMusic.asset.id}
                          previewUrl={pendingMusic.url ?? undefined}
                          originalSchedule={draft.templateMusic?.schedule}
                          onCancel={() => onPendingMusic(null)}
                          onAccept={decision => {
                            onCommitDraft({
                              ...draft,
                              music: pendingMusic.asset,
                              templateMusic: decision,
                              musicRightsConfirmed: true,
                              musicTiming: decision.choice === 're-sync' ? 'resync' : 'keep',
                            })
                            onPendingMusic(null)
                          }}
                        />
                      ) : null}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="style" className="mt-0 space-y-3">
                  <label className="flex flex-wrap items-center gap-2 text-xs font-medium">
                    Brand accent
                    <input
                      aria-label="Brand accent color"
                      type="color"
                      value={draft?.brandColor ?? '#ffffff'}
                      onChange={e => draft && onCommitDraft({ ...draft, brandColor: e.target.value })}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Brand accent tints closing lines that use accent color. Edit fonts and presets in the Text tab.
                  </p>
                </TabsContent>
              </div>
            </Tabs>
            {activeFill && activeSlot ? (
              <SlotPopover
                activeSlot={activeSlot}
                activeFill={activeFill}
                busy={busy}
                patchFill={patchFill}
                onCreateHold={onCreateHold}
                onClear={() => {
                  if (!draft) return
                  const next = { ...draft.slots }
                  delete next[activeSlot.id]
                  onCommitDraft({ ...draft, slots: next })
                }}
              />
            ) : null}
          </aside>
          <div className="col-span-3">{filmstrip}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden p-3">{previewBlock}</div>
          <div className="flex gap-2 border-t px-3 py-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onRightTab('text')}>Text</Button>
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onRightTab('music')}>Music</Button>
          </div>
          {filmstrip}
        </div>
      )}
    </div>
  )
}

function MotionStillPreview({
  activeSlot,
  activeFill,
  knownMedia,
  previewPreparing,
  projectStatus,
  previewFrameStyle,
}: {
  activeSlot: VideoTemplateRelease['family']['slots'][number] | undefined
  activeFill: StudioSlotFill | undefined
  knownMedia: Record<string, MediaItem>
  previewPreparing: boolean
  projectStatus: string | undefined
  previewFrameStyle: { aspectRatio: string; maxHeight: number; width: '100%'; maxWidth: number }
}) {
  const activeMedia = activeFill ? knownMedia[activeFill.asset.id] : undefined
  const activeStillUrl = activeMedia?.asset.kind === 'image'
    ? (activeMedia.stillUrl ?? activeMedia.url)
    : activeMedia?.url
  return (
    <div className="mx-auto w-full" style={previewFrameStyle}>
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-black">
        {previewPreparing || projectStatus === 'QUEUED' ? (
          <p className="p-4 text-center text-sm text-white/80" role="status">Preparing preview…</p>
        ) : activeStillUrl && activeMedia ? (
          activeMedia.asset.kind === 'image' ? (
            <img
              src={activeStillUrl}
              alt={activeMedia.label}
              className="h-full w-full object-contain"
              style={{ objectPosition: (activeFill?.focalX ?? 50) + '% ' + (activeFill?.focalY ?? 50) + '%' }}
            />
          ) : (
            <video key={activeMedia.asset.id} src={activeStillUrl} controls playsInline muted className="h-full w-full object-contain" preload="metadata" />
          )
        ) : (
          <p className="p-6 text-center text-sm text-white/70">Fill slots to preview your template</p>
        )}
      </div>
    </div>
  )
}

function SlotPopover({
  activeSlot,
  activeFill,
  busy,
  patchFill,
  onCreateHold,
  onClear,
}: {
  activeSlot: VideoTemplateRelease['family']['slots'][number]
  activeFill: StudioSlotFill
  busy: boolean
  patchFill: (id: string, changes: Partial<StudioSlotFill>) => void
  onCreateHold: (id: string) => void
  onClear: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger className={subtleBtn + ' m-2'}>Slot {activeSlot.ordinal} options</PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-xs">
        <p className="font-semibold">Slot {activeSlot.ordinal}</p>
        <label className="block space-y-1">Focal X · {activeFill.focalX}%
          <input type="range" min={0} max={100} value={activeFill.focalX} className="w-full"
            onChange={e => patchFill(activeSlot.id, { focalX: Number(e.target.value) })} />
        </label>
        <label className="block space-y-1">Focal Y · {activeFill.focalY}%
          <input type="range" min={0} max={100} value={activeFill.focalY} className="w-full"
            onChange={e => patchFill(activeSlot.id, { focalY: Number(e.target.value) })} />
        </label>
        {activeFill.asset.kind === 'video' ? (
          <label className="block space-y-1">Trim start (s)
            <input type="number" className={inputClass} min={0} step={1 / 30}
              value={(activeFill.sourceInFrame / 30).toFixed(2)}
              onChange={e => patchFill(activeSlot.id, { sourceInFrame: Math.max(0, Math.round(Number(e.target.value) * 30)) })} />
          </label>
        ) : null}
        {!activeSlot.playback && activeFill.asset.kind === 'video' && activeFill.remedy === 'hold' ? (
          <button type="button" className={subtleBtn} disabled={busy} onClick={() => onCreateHold(activeSlot.id)}>Recapture hold frame</button>
        ) : null}
        <button type="button" className={subtleBtn + ' text-destructive'} onClick={onClear}>Clear slot</button>
      </PopoverContent>
    </Popover>
  )
}
