'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { patchClip } from '@/lib/clips-api'
import { EditorTopBar } from '@/components/clips/editor/editor-top-bar'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { LayoutPanel } from '@/components/clips/editor/layout-panel'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { Timeline } from '@/components/clips/editor/timeline'
import { TranscriptPanel } from '@/components/clips/editor/transcript-panel'
import { useEditorState } from '@/components/clips/editor/use-editor-state'

function ComingSoon() {
  return <p className="text-sm text-muted-foreground">Coming in a later update</p>
}

export function EditorShell({
  projectId,
  clipId,
  initialTitle,
  durationMs,
  clipStartMs,
  initialEdits,
  words,
  cropShots,
  videoUrl,
}: {
  projectId: string
  clipId: string
  initialTitle: string
  durationMs: number
  clipStartMs: number
  initialEdits: unknown
  words: ClipWord[]
  cropShots: CropShot[]
  videoUrl: string | null
}) {
  const [title, setTitle] = useState(initialTitle)
  const [exportOpen, setExportOpen] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const edits0 = normalizeEdits(initialEdits, durationMs)
  const {
    edits,
    setEdits,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    addCutRange,
    setWordFix,
    setLayoutMode,
    setShotOverride,
    setTrim,
  } = useEditorState(clipId, durationMs, edits0)

  const seek = useCallback(
    (ms: number) => {
      const v = document.querySelector('video')
      if (v) v.currentTime = clipStartMs / 1000 + ms / 1000
      setCurrentMs(ms)
    },
    [clipStartMs],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const v = document.querySelector('video')
      if (e.code === 'Space' && v) {
        e.preventDefault()
        if (v.paused) void v.play()
        else v.pause()
      }
      if (e.code === 'ArrowLeft' && v) v.currentTime = Math.max(0, v.currentTime - 1)
      if (e.code === 'ArrowRight' && v) v.currentTime = v.currentTime + 1
      if ((e.code === 'Backspace' || e.code === 'Delete') && currentMs) {
        /* selection handled in transcript */
      }
      if (e.metaKey && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentMs, redo, undo])

  useEffect(() => {
    const t = setTimeout(() => {
      if (title !== initialTitle) void patchClip(clipId, { title })
    }, 800)
    return () => clearTimeout(t)
  }, [clipId, initialTitle, title])

  const removeCut = (range: [number, number]) => {
    setEdits({
      ...edits,
      cutRanges: edits.cutRanges.filter((c) => c[0] !== range[0] || c[1] !== range[1]),
    })
  }

  return (
    <div className="flex flex-col gap-4">
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <PreviewStage
          videoUrl={videoUrl}
          edits={edits}
          words={words}
          cropShots={cropShots}
          clipStartMs={clipStartMs}
          onTime={(t) => setCurrentMs((t - clipStartMs / 1000) * 1000)}
        />
        <div className="flex flex-col gap-3">
          <Timeline
            durationMs={durationMs}
            edits={edits}
            words={words}
            currentMs={currentMs}
            onSeek={seek}
            onTrimChange={setTrim}
          />
          <Tabs defaultValue="transcript">
            <TabsList>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="captions">Captions</TabsTrigger>
              <TabsTrigger value="broll">B-roll</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
              <TabsTrigger value="dub">Dub</TabsTrigger>
              <TabsTrigger value="brand">Brand</TabsTrigger>
            </TabsList>
            <TabsContent value="transcript">
              <TranscriptPanel
                words={words}
                edits={edits}
                onSeek={seek}
                onAddCut={addCutRange}
                onWordFix={setWordFix}
                onRestoreCut={removeCut}
              />
            </TabsContent>
            <TabsContent value="layout">
              <LayoutPanel
                edits={edits}
                shots={cropShots}
                onMode={setLayoutMode}
                onShotFocus={setShotOverride}
                onRerunReframe={() => toastStub()}
              />
            </TabsContent>
            <TabsContent value="captions"><ComingSoon /></TabsContent>
            <TabsContent value="broll"><ComingSoon /></TabsContent>
            <TabsContent value="audio"><ComingSoon /></TabsContent>
            <TabsContent value="thumbnail"><ComingSoon /></TabsContent>
            <TabsContent value="dub"><ComingSoon /></TabsContent>
            <TabsContent value="brand"><ComingSoon /></TabsContent>
          </Tabs>
        </div>
      </div>
      <ExportDialog clipId={clipId} title={title} open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}

function toastStub() {
  /* reframe queue — future milestone */
}
