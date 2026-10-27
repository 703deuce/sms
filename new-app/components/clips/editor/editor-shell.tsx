'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorRail, EDITOR_RAIL_ITEMS, editorRailIcon, type EditorPanelId } from '@/components/clips/editor/editor-rail'
import { EditorMobileRail } from '@/components/clips/editor/editor-mobile-rail'
import { TAB_META } from '@/components/clips/editor/editor-tab-meta'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { PanelRightOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClipBounds } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import type { CropTrack } from '@/lib/clips/crop-track'
import { requestClipReframe } from '@/lib/clips-api'
import { patchClip } from '@/lib/clips-api'
import { outputDurationFromEdits } from '@/lib/clips/editor-playback'
import { playWithSound } from '@/lib/clips/video-playback'
import { EditorTopBar } from '@/components/clips/editor/editor-top-bar'
import { CaptionsPanel } from '@/components/clips/editor/captions-panel'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { LayoutPanel } from '@/components/clips/editor/layout-panel'
import { clipLayoutChip, clipWhySummary, type ClipAiMeta } from '@/lib/clips/clip-results-chips'
import { PlayerControls } from '@/components/clips/editor/player-controls'
import { PreviewStage, seekToOutputMs } from '@/components/clips/editor/preview-stage'
import { AudioPanel } from '@/components/clips/editor/audio-panel'
import { useDubPreview } from '@/components/clips/editor/use-dub-preview'
import { useAudioMix } from '@/components/clips/editor/use-audio-mix'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { ClipFillerReview } from '@/components/clips/editor/clip-filler-review'
import { ClipGapReview } from '@/components/clips/editor/clip-gap-review'
import type { ClipGapToolSettings } from '@/components/clips/editor/clip-shorten-gaps-panel'
import { StudioSoundPreview } from '@/components/script-editor/studio-sound-preview'
import { normalizeAudioEdits } from '@/lib/clips/audio'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { applyBrandTemplateToEdits } from '@/lib/clips/apply-brand'
import { clipStyleSettingsFromEdits, type BrandTemplateSettings } from '@/lib/clips/brand'
import { saveClipBrandTemplate } from '@/lib/clips-api'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import { useSetBreadcrumbTitle } from '@/components/shell/breadcrumb-context'
import { toast } from 'sonner'
import { EditorPanelErrorBoundary } from '@/components/clips/editor/editor-panel-error-boundary'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'

function isEditableTarget(t: EventTarget | null) {
  if (!t || !(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
}

export function EditorShell({
  projectId,
  projectTitle,
  clipId,
  initialTitle,
  serverUpdatedAt,
  bounds,
  initialEdits,
  words,
  cropShots,
  cropTrack,
  videoUrl,
  posterUrl = null,
  aiMeta,
  brollMedia: initialBrollMedia = [],
  reframeV2Enabled = false,
}: {
  projectId: string
  projectTitle?: string
  clipId: string
  initialTitle: string
  serverUpdatedAt?: string
  bounds: ClipBounds
  initialEdits: ClipEditsV2
  words: SourceWord[]
  cropShots: CropShot[]
  cropTrack: CropTrack | null
  videoUrl: string | null
  posterUrl?: string | null
  aiMeta?: { brollIdeas?: string[] } | null
  brollMedia?: BrollMediaRow[]
  reframeV2Enabled?: boolean
}) {
  const [title, setTitle] = useState(initialTitle)
  useSetBreadcrumbTitle('project', projectTitle)
  useSetBreadcrumbTitle('clip', title)
  const [exportOpen, setExportOpen] = useState(false)
  const [fillerReviewOpen, setFillerReviewOpen] = useState(false)
  const [gapReviewOpen, setGapReviewOpen] = useState(false)
  const [gapToolSettings, setGapToolSettings] = useState<ClipGapToolSettings>({
    mode: 'more_than',
    minGapSec: 0.6,
    maxGapSec: 3,
    targetGapSec: 0.35,
  })
  const [panel, setPanel] = useState<EditorPanelId>('transcript')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const selectPanel = useCallback((id: EditorPanelId) => {
    setPanel(id)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobilePanelOpen(true)
    }
  }, [])

  useEffect(() => {
    if (!EDITOR_RAIL_ITEMS.some((item) => item.id === panel)) {
      setPanel('transcript')
    }
  }, [panel])
  const [outputMs, setOutputMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playerMuted, setPlayerMuted] = useState(false)
  const [playerVolume, setPlayerVolume] = useState(100)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const selectionRef = useRef<TranscriptSelection | null>(null)
  const {
    edits,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    addCutRange,
    setWordFix,
    restoreWord,
    restoreCutRange,
    setLayoutMode,
    setShotOverride,
    setTrim,
    setCaptions,
    toggleEmphasis,
    attachMusicGeneration,
    patchMusic,
    setMusic,
    addSfx,
    updateSfx,
    removeSfx,
    setEdits,
    patchStudioSound,
    flushSave,
    syncServerUpdatedAt,
  } = useEditorState(clipId, bounds, initialEdits, { serverUpdatedAt, words })

  const { words: editorWords, wordsLoading } = useEditorWords(clipId, words, bounds, edits.trim)

  const audioNorm = useMemo(() => normalizeAudioEdits(edits.audio), [edits.audio])
  const studioSound = audioNorm.studioSound
  const studioGenId = studioSound?.enabled && studioSound.generationId ? studioSound.generationId : null
  const studioGen = useGeneration(studioGenId)
  const musicGenId = edits.audio?.music?.generationId ?? null
  const musicGen = useGeneration(musicGenId)
  const { dubs, dubAudioUrl, useDubAudio, previewWords, duckWords } = useDubPreview(
    clipId,
    edits,
    editorWords,
  )
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const outDur = outputDurationFromEdits(edits)
  useAudioMix({
    videoRef,
    edits,
    words: duckWords,
    musicUrl: musicGen.downloadUrl,
    dubUrl: dubAudioUrl,
    useDubAudio,
    sfxCues: [],
    outputMs,
    playing,
  })

  useEffect(() => {
    const key = (edits.brand as { logoKey?: string } | undefined)?.logoKey
    if (!key) {
      setBrandLogoUrl(null)
      return
    }
    void clipsFetch<{ url: string }>(`/api/clips/brand/logo?key=${encodeURIComponent(key)}`)
      .then((d) => setBrandLogoUrl(d.url))
      .catch(() => setBrandLogoUrl(null))
  }, [edits.brand])

  const saveClipTemplate = useCallback(async () => {
    const name = window.prompt('Clip template name (captions + layout + brand kit)')
    if (!name?.trim()) return
    try {
      const logoKey = (edits.brand as { logoKey?: string } | undefined)?.logoKey ?? null
      await saveClipBrandTemplate({
        name: name.trim(),
        settings: clipStyleSettingsFromEdits(edits),
        logoKey,
      })
      toast.success('Clip template saved — apply from project results or Brand')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }, [edits])

  const applyBrand = useCallback(async () => {
    try {
      const data = await clipsFetch<{
        template: {
          id: string
          logoKey: string | null
          introVideoKey: string | null
          outroVideoKey: string | null
          settings: BrandTemplateSettings
        } | null
        logoUrl: string | null
      }>('/api/clips/brand')
      if (!data.template) {
        toast.error('No brand template saved')
        return
      }
      setEdits(
        applyBrandTemplateToEdits(edits, {
          id: data.template.id,
          logoKey: data.template.logoKey,
          introVideoKey: data.template.introVideoKey,
          outroVideoKey: data.template.outroVideoKey,
          settings: data.template.settings,
        }),
      )
      setBrandLogoUrl(data.logoUrl)
      toast.success('Brand applied')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply brand failed')
    }
  }, [edits, setEdits])

  const onTick = useCallback((tick: { sourceMs: number; outputMs: number; playing: boolean }) => {
    setOutputMs(tick.outputMs)
    setPlaying(tick.playing)
  }, [])

  const seekSource = useCallback((sourceMs: number) => {
    const v = videoRef.current
    if (v) v.currentTime = sourceMs / 1000
  }, [])

  const seekOutput = useCallback(
    (ms: number) => {
      const v = videoRef.current
      if (v) seekToOutputMs(v, edits, ms)
    },
    [edits],
  )

  const togglePlay = async () => {
    const v = videoRef.current
    if (!v) return
    if (!v.paused) {
      v.pause()
      return
    }
    v.volume = playerVolume / 100
    const mode = await playWithSound(v)
    if (mode === 'muted') {
      setPlayerMuted(true)
    } else {
      setPlayerMuted(false)
    }
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v || useDubAudio) return
    v.muted = playerMuted
    v.volume = playerVolume / 100
  }, [playerMuted, playerVolume, useDubAudio, videoUrl])

  const deleteSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.startMs === sel.endMs) return
    const a = Math.min(sel.startMs, sel.endMs)
    const b = Math.max(sel.startMs, sel.endMs)
    const selected = editorWords.filter((w) => {
      const s = w.s * 1000
      const e = w.e * 1000
      return e > a && s < b
    })
    if (!selected.length) return
    const wa = selected[0]
    const wb = selected[selected.length - 1]
    addCutRange([Math.round(wa.s * 1000), Math.round(wb.e * 1000)])
    sel.clear()
  }, [addCutRange, editorWords])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const v = videoRef.current
      if (e.code === 'Space' && v) {
        e.preventDefault()
        togglePlay()
      }
      if (e.code === 'ArrowLeft' && v) seekToOutputMs(v, edits, Math.max(0, outputMs - 1000))
      if (e.code === 'ArrowRight' && v) seekToOutputMs(v, edits, Math.min(outDur, outputMs + 1000))
      if (e.code === 'Backspace' || e.code === 'Delete') {
        e.preventDefault()
        deleteSelection()
      }
      if (e.metaKey && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelection, edits, outDur, outputMs, redo, undo])

  useEffect(() => {
    const t = setTimeout(() => {
      if (title !== initialTitle) {
        void patchClip(clipId, { title }).then((res) => {
          if (res.updatedAt) syncServerUpdatedAt(res.updatedAt)
        })
      }
    }, 800)
    return () => clearTimeout(t)
  }, [clipId, initialTitle, syncServerUpdatedAt, title])

  const TabIcon = editorRailIcon(panel)
  const meta = TAB_META[panel]
  const previewAspect = edits.aspectRatio ?? '9:16'
  const aspectStyle =
    previewAspect === '16:9'
      ? '16 / 9'
      : previewAspect === '1:1'
        ? '1 / 1'
        : previewAspect === '4:5'
          ? '4 / 5'
          : '9 / 16'
  const pickerWhy = clipWhySummary(aiMeta as ClipAiMeta | null)
  const detectedLayout = clipLayoutChip(aiMeta as ClipAiMeta | null)

  const panelBody = (
    <>
      <div className={panel === 'transcript' ? undefined : 'hidden'} aria-hidden={panel !== 'transcript'}>
        <EditorPanelErrorBoundary label="Script">
        <TranscriptPanel
          words={editorWords}
          wordsLoading={wordsLoading}
          clipStartMs={bounds.clipStartMs}
          clipEndMs={bounds.clipEndMs}
          shots={cropShots}
          edits={edits}
          onSeek={seekSource}
          onAddCut={addCutRange}
          onWordFix={setWordFix}
          onRestoreWord={restoreWord}
          onRestoreCutRange={restoreCutRange}
          onExtendTrim={(ms) => {
            if (ms < edits.trim.in) setTrim({ in: ms, out: edits.trim.out })
            else if (ms > edits.trim.out) setTrim({ in: edits.trim.in, out: ms })
          }}
          onToggleEmphasis={edits.captions?.keywordHighlight ? toggleEmphasis : undefined}
          onOpenFillerReview={() => setFillerReviewOpen(true)}
          selectionRef={selectionRef}
        />
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'layout' ? 'p-3' : 'hidden'} aria-hidden={panel !== 'layout'}>
        <EditorPanelErrorBoundary label="Layout">
        <LayoutPanel
          edits={edits}
          shots={cropShots}
          onMode={setLayoutMode}
          onShotFocus={setShotOverride}
          onRerunReframe={() => void requestClipReframe(clipId)}
          onApplyBrand={() => void applyBrand()}
          onEdits={setEdits}
          reframeV2Enabled={reframeV2Enabled}
          appliedLayoutLabel={clipLayoutChip(aiMeta as ClipAiMeta | null)}
          clipId={clipId}
          words={editorWords}
          clipStartMs={bounds.clipStartMs}
          gapToolSettings={gapToolSettings}
          onGapToolSettingsChange={(patch) => setGapToolSettings((s) => ({ ...s, ...patch }))}
          onAddCut={addCutRange}
          onSeekSource={seekSource}
          onOpenGapReview={() => setGapReviewOpen(true)}
        />
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'captions' ? undefined : 'hidden'} aria-hidden={panel !== 'captions'}>
        <EditorPanelErrorBoundary label="Captions">
        <CaptionsPanel
          clipId={clipId}
          edits={edits}
          words={editorWords}
          onWordFix={setWordFix}
          onChange={setCaptions}
          onApplyBrand={() => void applyBrand()}
          onSaveClipTemplate={() => void saveClipTemplate()}
        />
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'audio' ? undefined : 'hidden'} aria-hidden={panel !== 'audio'}>
        <EditorPanelErrorBoundary label="Audio">
        <AudioPanel
          clipId={clipId}
          edits={edits}
          outputDurationMs={outDur}
          playheadMs={outputMs}
          onSuggestMusic={() => {}}
          onAttachMusic={attachMusicGeneration}
          onPatchMusic={patchMusic}
          onRemoveMusic={() => setMusic(null)}
          onAddSfx={(generationId, atMs) => addSfx({ generationId, atMs, volume: 0.8 })}
          onUpdateSfx={updateSfx}
          onRemoveSfx={removeSfx}
          onPatchStudioSound={patchStudioSound}
        />
        </EditorPanelErrorBoundary>
      </div>
    </>
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] max-w-[100vw] flex-col overflow-x-hidden bg-background">
      <EditorTopBar
          backHref={`/app/clips/${projectId}`}
          title={title}
          onTitleChange={setTitle}
          saveState={saveState}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onExport={() => setExportOpen(true)}
        />
      <ClipFillerReview
        clipId={clipId}
        words={editorWords}
        edits={edits}
        open={fillerReviewOpen}
        onOpenChange={setFillerReviewOpen}
        onAddCut={addCutRange}
        onSeek={seekSource}
      />
      <ClipGapReview
        clipId={clipId}
        words={editorWords}
        edits={edits}
        open={gapReviewOpen}
        onOpenChange={setGapReviewOpen}
        onAddCut={addCutRange}
        onSeek={seekSource}
        minGapSec={gapToolSettings.minGapSec}
        maxGapSec={gapToolSettings.maxGapSec}
        gapMode={gapToolSettings.mode}
        targetGapSec={gapToolSettings.targetGapSec}
        onTargetGapSecChange={(n) => setGapToolSettings((s) => ({ ...s, targetGapSec: n }))}
      />
      <EditorMobileRail active={panel} onChange={selectPanel} />
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_56px_minmax(0,380px)] xl:grid-cols-[minmax(0,1fr)_56px_minmax(0,420px)]">
        <section className="flex min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-2 sm:p-3 md:p-4">
          <div className="relative grid min-h-0 flex-1 place-items-center bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.02_280)_0%,var(--background)_70%)] p-2 md:p-4">
            <div
              className="relative h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10"
              style={{ aspectRatio: aspectStyle }}
            >
            {(edits.layout.shotOverrides?.length ?? 0) > 0 ? (
              <span
                className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15"
                aria-hidden
              >
                Manual framing
              </span>
            ) : edits.layout.mode === 'auto' || edits.layout.mode === 'dynamic' ? (
              <span
                className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15"
                aria-hidden
              >
                AI reframing
              </span>
            ) : null}
            <EditorPanelErrorBoundary label="Preview">
            <PreviewStage
              videoUrl={videoUrl}
              posterUrl={posterUrl}
              edits={edits}
              words={editorWords}
              previewWords={previewWords}
              brandLogoUrl={brandLogoUrl}
              cropTrack={cropTrack}
              brollMedia={initialBrollMedia}
              videoRef={videoRef}
              onTick={onTick}
            />
            <StudioSoundPreview
              videoRef={videoRef}
              isolatedUrl={studioGen.downloadUrl}
              mix={studioSound?.mix ?? 0.35}
              enabled={Boolean(studioSound?.enabled && studioGen.status === 'READY' && !useDubAudio)}
            />
            </EditorPanelErrorBoundary>
            </div>
          </div>
          {pickerWhy || detectedLayout ? (
            <div className="max-w-xl space-y-1 px-1">
              {detectedLayout ? (
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">Detected layout:</span> {detectedLayout}
                </p>
              ) : null}
              {pickerWhy ? (
                <p className="line-clamp-2 text-xs text-muted-foreground" title={pickerWhy}>{pickerWhy}</p>
              ) : null}
            </div>
          ) : null}
          <div className="min-w-0 w-full">
          <PlayerControls
            playing={playing}
            outputMs={outputMs}
            outputDurationMs={outDur}
            onToggle={() => void togglePlay()}
            onScrub={seekOutput}
            muted={playerMuted}
            volume={playerVolume}
            onMuteToggle={() => {
              const v = videoRef.current
              if (!v) return
              const next = !playerMuted
              setPlayerMuted(next)
              v.muted = next
              if (!next) {
                v.volume = playerVolume / 100
                void playWithSound(v)
              }
            }}
            onVolumeChange={(pct) => {
              setPlayerVolume(pct)
              const v = videoRef.current
              if (v) {
                v.volume = pct / 100
                if (pct > 0) {
                  v.muted = false
                  setPlayerMuted(false)
                }
              }
            }}
          />
          </div>
        </section>
        <EditorRail active={panel} onChange={selectPanel} />
        <aside
          className={cn(
            'flex min-h-0 flex-col border-border bg-card',
            'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:max-h-[85dvh] max-md:rounded-t-xl max-md:border-t max-md:shadow-2xl',
            !mobilePanelOpen && 'max-md:hidden',
            'md:relative md:border-l md:max-h-none',
          )}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <TabIcon className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">{meta.label}</h2>
            <span className="ml-auto text-xs text-muted-foreground">{meta.hint}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobilePanelOpen(false)}
            >
              Close
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">{panelBody}</div>
          </ScrollArea>
        </aside>
      </div>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg md:hidden"
        aria-label="Open editor panel"
        onClick={() => setMobilePanelOpen(true)}
      >
        <PanelRightOpen className="size-5" />
      </Button>
      <ClipperSurfaceErrorBoundary surface="Export">
        <ExportDialog
        clipId={clipId}
        title={title}
        edits={edits}
        dubs={dubs}
        layoutMode={edits.layout.mode}
        onLayoutModeChange={setLayoutMode}
        platform={
          (aiMeta as { streamer?: { platform?: string } } | null)?.streamer?.platform === 'kick'
            ? 'kick'
            : (aiMeta as { streamer?: { platform?: string } } | null)?.streamer?.platform === 'twitch'
              ? 'twitch'
              : undefined
        }
        defaultChannelUrl={
          (() => {
            const s = (aiMeta as { streamer?: { platform?: string; login?: string; meta?: { channel?: string; platform?: string } } } | null)
              ?.streamer
            const login = s?.login || s?.meta?.channel
            const platform = s?.platform || s?.meta?.platform
            if (!login || !platform) return undefined
            return platform === 'kick' ? `https://kick.com/${login}` : `https://twitch.tv/${login}`
          })()
        }
        onAudioTrack={(track) => setEdits({ ...edits, audioTrack: track })}
        open={exportOpen}
        onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })}
        onBeforeExport={() => flushSave()}
        onClose={() => setExportOpen(false)}
      />
      </ClipperSurfaceErrorBoundary>
    </div>
  )
}
