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
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import type { ClipEditsV2 } from '@/lib/clips/edits'

function ComingSoon() {
  return <p className="p-3 text-sm text-muted-foreground">Coming in a later update</p>
}

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
}) {
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
  } = useEditorState(clipId, bounds, initialEdits)

  const outDur = outputDurationFromEdits(edits)

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
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="relative min-h-[320px] flex-1">
            <PreviewStage
              videoUrl={videoUrl}
              edits={edits}
              words={words}
              cropTrack={cropTrack}
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
              onSeekOutput={seekOutput}
              onTrimChange={setTrim}
            />
          </div>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-xl border border-border">
          <Tabs defaultValue="transcript">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-2">
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="captions">Captions</TabsTrigger>
              <TabsTrigger value="broll">B-roll</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
              <TabsTrigger value="dub">Dub</TabsTrigger>
              <TabsTrigger value="brand">Brand</TabsTrigger>
            </TabsList>
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
              />
            </TabsContent>
            <TabsContent value="captions" className="mt-0">
              <CaptionsPanel edits={edits} onChange={setCaptions} />
            </TabsContent>
            <TabsContent value="broll"><ComingSoon /></TabsContent>
            <TabsContent value="audio"><ComingSoon /></TabsContent>
            <TabsContent value="thumbnail"><ComingSoon /></TabsContent>
            <TabsContent value="dub"><ComingSoon /></TabsContent>
            <TabsContent value="brand"><ComingSoon /></TabsContent>
          </Tabs>
        </aside>
      </div>
      <ExportDialog clipId={clipId} title={title} open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
