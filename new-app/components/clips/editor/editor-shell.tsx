'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ClipBounds } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import type { CropTrack } from '@/lib/clips/crop-track'
import { requestClipReframe } from '@/lib/clips-api'
import { patchClip } from '@/lib/clips-api'
import { outputDurationFromEdits } from '@/lib/clips/editor-playback'
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
import { toast } from 'sonner'

function isEditableTarget(t: EventTarget | null) {
  if (!t || !(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
}

export function EditorShell({
  projectId,
  clipId,
  initialTitle,
  bounds,
  initialEdits,
  words,
  cropShots,
  cropTrack,
  videoUrl,
  aiMeta,
  brollMedia: initialBrollMedia = [],
}: {
  projectId: string
  clipId: string
  initialTitle: string
  bounds: ClipBounds
  initialEdits: ClipEditsV2
  words: SourceWord[]
  cropShots: CropShot[]
  cropTrack: CropTrack | null
  videoUrl: string | null
  aiMeta?: { brollIdeas?: string[] } | null
  brollMedia?: BrollMediaRow[]
}) {
  const [brollMedia, setBrollMedia] = useState<BrollMediaRow[]>(initialBrollMedia)
  const [title, setTitle] = useState(initialTitle)
  const [exportOpen, setExportOpen] = useState(false)
  const [outputMs, setOutputMs] = useState(0)
  const [playing, setPlaying] = useState(false)
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

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

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

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="shrink-0 border-b border-border px-4 py-2">
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
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="relative min-h-[320px] flex-1">
            <PreviewStage
              videoUrl={videoUrl}
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
          <PlayerControls
            playing={playing}
            outputMs={outputMs}
            outputDurationMs={outDur}
            onToggle={togglePlay}
            onScrub={seekOutput}
          />
          <div className="min-w-0 overflow-x-auto">
            <Timeline
              edits={edits}
              words={words}
              shots={cropShots}
              outputMs={outputMs}
              clipOutputDurationMs={outDur}
              onSeekOutput={seekOutput}
              onTrimChange={setTrim}
              onBrollChange={updateBrollItem}
            />
          </div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-xl border border-border">
          <Tabs defaultValue="transcript">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-2">
              <TabsTrigger value="producer">Producer</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="captions">Captions</TabsTrigger>
              <TabsTrigger value="broll">B-roll</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
              <TabsTrigger value="dub">Dub</TabsTrigger>
              <TabsTrigger value="brand">Brand</TabsTrigger>
            </TabsList>
            <TabsContent value="producer" className="mt-0 h-[min(60vh,520px)]">
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
            </TabsContent>
            <TabsContent value="transcript" className="mt-0">
              <TranscriptPanel
                words={words}
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
            </TabsContent>
            <TabsContent value="layout" className="mt-0 p-3">
              <LayoutPanel
                edits={edits}
                shots={cropShots}
                onMode={setLayoutMode}
                onShotFocus={setShotOverride}
                onRerunReframe={() => void requestClipReframe(clipId)}
                onApplyBrand={() => void applyBrand()}
                onEdits={setEdits}
              />
            </TabsContent>
            <TabsContent value="captions" className="mt-0">
              <CaptionsPanel
                clipId={clipId}
                edits={edits}
                onChange={setCaptions}
                onApplyBrand={() => void applyBrand()}
              />
            </TabsContent>
            <TabsContent value="broll" className="mt-0">
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
            </TabsContent>
            <TabsContent value="audio" className="mt-0">
              <AudioPanel
                clipId={clipId}
                edits={edits}
                outputDurationMs={outDur}
                playheadMs={outputMs}
                onSuggestMusic={() => {}}
                onAttachMusic={attachMusicGeneration}
                onPatchMusic={patchMusic}
                onRemoveMusic={() => setMusic(null)}
                onAddSfx={(generationId, atMs) =>
                  addSfx({ generationId, atMs, volume: 0.8 })
                }
                onUpdateSfx={updateSfx}
                onRemoveSfx={removeSfx}
              />
            </TabsContent>
            <TabsContent value="thumbnail" className="mt-0">
              <ThumbnailPanel clipId={clipId} edits={edits} onEdits={setEdits} />
            </TabsContent>
            <TabsContent value="dub" className="mt-0">
              <DubPanel
                clipId={clipId}
                durationMs={outDur}
                edits={edits}
                onEdits={setEdits}
                onRefresh={refreshDubs}
                dubs={dubs}
              />
            </TabsContent>
            <TabsContent value="brand" className="mt-0">
              <BrandPanel edits={edits} onEdits={setEdits} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
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
