'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorRail, editorRailIcon, type EditorPanelId } from '@/components/clips/editor/editor-rail'
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
import { LayoutPanel } from '@/components/clips/editor/layout-panel'
import { PlayerControls } from '@/components/clips/editor/player-controls'
import { PreviewStage, seekToOutputMs } from '@/components/clips/editor/preview-stage'
import { Timeline } from '@/components/clips/editor/timeline'
import { AudioPanel } from '@/components/clips/editor/audio-panel'
import { DubPanel } from '@/components/clips/editor/dub-panel'
import { useDubPreview } from '@/components/clips/editor/use-dub-preview'
import { BrollPanel } from '@/components/clips/editor/broll-panel'
import { ThumbnailPanel } from '@/components/clips/editor/thumbnail-panel'
import { BrandPanel } from '@/components/clips/editor/brand-panel'
import { ProducerPanel } from '@/components/clips/producer/producer-panel'
import { useAudioMix } from '@/components/clips/editor/use-audio-mix'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { applyBrandTemplateToEdits } from '@/lib/clips/apply-brand'
import type { BrandTemplateSettings } from '@/lib/clips/brand'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import { useSetBreadcrumbTitle } from '@/components/shell/breadcrumb-context'
import { toast } from 'sonner'

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
  const [brollMedia, setBrollMedia] = useState<BrollMediaRow[]>(initialBrollMedia)
  const [title, setTitle] = useState(initialTitle)
  useSetBreadcrumbTitle('project', projectTitle)
  useSetBreadcrumbTitle('clip', title)
  const [exportOpen, setExportOpen] = useState(false)
  const [panel, setPanel] = useState<EditorPanelId>('transcript')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const producerPanelRef = useRef<HTMLDivElement>(null)
  const selectPanel = useCallback((id: EditorPanelId) => {
    setPanel(id)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobilePanelOpen(true)
    }
    if (id === 'producer') {
      requestAnimationFrame(() => {
        producerPanelRef.current?.focus()
      })
    }
  }, [])
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
    setLayoutMode,
    setShotOverride,
    setTrim,
    setCaptions,
    toggleEmphasis,
    mergeBroll,
    setBroll,
    removeBroll,
    updateBrollItem,
    attachMusicGeneration,
    patchMusic,
    setMusic,
    addSfx,
    updateSfx,
    removeSfx,
    setEdits,
    applyProducerPatch,
    producerStrip,
    clearProducerStrip,
    flushSave,
  } = useEditorState(clipId, bounds, initialEdits)

  const mergeBrollMedia = useCallback((rows: BrollMediaRow[]) => {
    setBrollMedia((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]))
      for (const row of rows) map.set(row.id, row)
      return [...map.values()]
    })
  }, [])

  const musicGenId = edits.audio?.music?.generationId ?? null
  const musicGen = useGeneration(musicGenId)
  const { dubs, refreshDubs, dubAudioUrl, useDubAudio, previewWords, duckWords } = useDubPreview(
    clipId,
    edits,
    words,
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
    const selected = words.filter((w) => {
      const s = w.s * 1000
      const e = w.e * 1000
      return e > a && s < b
    })
    if (!selected.length) return
    const wa = selected[0]
    const wb = selected[selected.length - 1]
    addCutRange([Math.round(wa.s * 1000), Math.round(wb.e * 1000)])
    sel.clear()
  }, [addCutRange, words])

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
      if (title !== initialTitle) void patchClip(clipId, { title })
    }, 800)
    return () => clearTimeout(t)
  }, [clipId, initialTitle, title])

  const TabIcon = editorRailIcon(panel)
  const meta = TAB_META[panel]

  const panelBody = (
    <>
      <div
        ref={producerPanelRef}
        tabIndex={-1}
        id="editor-panel-producer"
        className={panel === 'producer' ? 'min-h-[min(60vh,520px)] outline-none' : 'hidden'}
        aria-hidden={panel !== 'producer'}
      >
        <ProducerPanel
          clipId={clipId}
          bounds={bounds}
          edits={edits}
          onUndo={() => {
            undo()
            clearProducerStrip()
          }}
          onApplyEdits={(next, n, before) => {
            applyProducerPatch(next, before, n)
          }}
        />
      </div>
      <div className={panel === 'transcript' ? undefined : 'hidden'} aria-hidden={panel !== 'transcript'}>
        <TranscriptPanel
          words={words}
          clipStartMs={bounds.clipStartMs}
          clipEndMs={bounds.clipEndMs}
          shots={cropShots}
          edits={edits}
          onSeek={seekSource}
          onAddCut={addCutRange}
          onWordFix={setWordFix}
          onRestoreWord={restoreWord}
          onExtendTrim={(ms) => {
            if (ms < edits.trim.in) setTrim({ in: ms, out: edits.trim.out })
            else if (ms > edits.trim.out) setTrim({ in: edits.trim.in, out: ms })
          }}
          onToggleEmphasis={edits.captions?.keywordHighlight ? toggleEmphasis : undefined}
          selectionRef={selectionRef}
        />
      </div>
      <div className={panel === 'layout' ? 'p-3' : 'hidden'} aria-hidden={panel !== 'layout'}>
        <LayoutPanel
          edits={edits}
          shots={cropShots}
          onMode={setLayoutMode}
          onShotFocus={setShotOverride}
          onRerunReframe={() => void requestClipReframe(clipId)}
          onApplyBrand={() => void applyBrand()}
          onEdits={setEdits}
          reframeV2Enabled={reframeV2Enabled}
        />
      </div>
      <div className={panel === 'captions' ? undefined : 'hidden'} aria-hidden={panel !== 'captions'}>
        <CaptionsPanel
          clipId={clipId}
          edits={edits}
          onChange={setCaptions}
          onApplyBrand={() => void applyBrand()}
        />
      </div>
      <div className={panel === 'broll' ? undefined : 'hidden'} aria-hidden={panel !== 'broll'}>
        <BrollPanel
          clipId={clipId}
          edits={edits}
          outputDurationMs={outDur}
          playheadMs={outputMs}
          aiMeta={aiMeta}
          brollMedia={brollMedia}
          onMergeBroll={mergeBroll}
          onSetBroll={setBroll}
          onRemoveBroll={removeBroll}
          onBrollMedia={mergeBrollMedia}
          onFlushEdits={flushSave}
        />
      </div>
      <div className={panel === 'audio' ? undefined : 'hidden'} aria-hidden={panel !== 'audio'}>
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
        />
      </div>
      <div className={panel === 'thumbnail' ? undefined : 'hidden'} aria-hidden={panel !== 'thumbnail'}>
        <ThumbnailPanel clipId={clipId} edits={edits} onEdits={setEdits} />
      </div>
      <div className={panel === 'dub' ? undefined : 'hidden'} aria-hidden={panel !== 'dub'}>
        <DubPanel
          clipId={clipId}
          durationMs={outDur}
          edits={edits}
          onEdits={setEdits}
          onRefresh={refreshDubs}
          dubs={dubs}
        />
      </div>
      <div className={panel === 'brand' ? undefined : 'hidden'} aria-hidden={panel !== 'brand'}>
        <BrandPanel edits={edits} onEdits={setEdits} />
      </div>
    </>
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background">
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
          onOpenProducer={() => selectPanel('producer')}
          producerOpen={panel === 'producer'}
          producerStrip={
            producerStrip
              ? {
                  changeCount: producerStrip.changeCount,
                  onUndo: () => {
                    undo()
                    clearProducerStrip()
                  },
                }
              : null
          }
        />
      <EditorMobileRail active={panel} onChange={selectPanel} />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_56px_380px] xl:grid-cols-[minmax(0,1fr)_56px_420px]">
        <section className="flex min-h-0 min-w-0 flex-col gap-3 p-3 md:p-4">
          <div className="relative grid min-h-0 flex-1 place-items-center bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.02_280)_0%,var(--background)_70%)] p-2 md:p-4">
            <div className="aspect-[9/16] h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10">
            <PreviewStage
              videoUrl={videoUrl}
              posterUrl={posterUrl}
              edits={edits}
              words={words}
              previewWords={previewWords}
              brandLogoUrl={brandLogoUrl}
              cropTrack={cropTrack}
              brollMedia={brollMedia}
              videoRef={videoRef}
              onTick={onTick}
            />
            </div>
          </div>
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
          <div className="min-w-0 overflow-x-auto">
            <Timeline
              edits={edits}
              words={words}
              shots={cropShots}
              outputMs={outputMs}
              clipOutputDurationMs={outDur}
              videoUrl={videoUrl}
              onSeekOutput={seekOutput}
              onTrimChange={setTrim}
              onBrollChange={updateBrollItem}
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
      <ExportDialog
        clipId={clipId}
        title={title}
        edits={edits}
        dubs={dubs}
        onAudioTrack={(track) => setEdits({ ...edits, audioTrack: track })}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  )
}
