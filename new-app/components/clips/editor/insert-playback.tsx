'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { orderedKeepSegments } from '@/lib/clips/edits'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { insertWindows, type InsertWindow } from '@/lib/clips/editor/inserts'
import { crossedCue, insertCues, type InsertCue } from '@/lib/clips/editor/insert-playback'
import { sourceById } from '@/lib/clips/editor/sources'
import { sourceMsFromVideo } from '@/lib/clips/editor-playback'

/**
 * E5b: plays inserted clips in the preview. Holds the main video at the insert point, shows the
 * insert (its own sound or muted, Fill / Fit) for its length, then resumes. Appends play when the
 * main video reaches the end. Own rAF loop; renders nothing when the clip has no inserts.
 */
export function InsertPlayback({
  videoRef,
  edits,
  words,
  sourceUrls,
  mediaOffsetMs = 0,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  edits: ClipEditsV2
  words: SourceWord[]
  sourceUrls?: Record<string, string> | null
  mediaOffsetMs?: number
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const vidRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const plan = useMemo(() => {
    if (!edits.inserts?.length) return null
    const segs = orderedKeepSegments(editorPreviewEdits(edits, words))
    const windows = insertWindows(segs, edits.inserts)
    const appendIds = new Set(edits.inserts.filter((i) => i.append).map((i) => i.id))
    return { cues: insertCues(segs, windows, appendIds), endSrcMs: segs.length ? segs[segs.length - 1]![1] : 0 }
  }, [edits, words])
  const planRef = useRef(plan)
  planRef.current = plan
  const urlRef = useRef(sourceUrls)
  urlRef.current = sourceUrls
  const editsRef = useRef(edits)
  editsRef.current = edits

  useEffect(() => {
    if (!plan) return
    let raf = 0
    let prevSrc: number | null = null
    let wasPlaying = false
    let hold: { cue: InsertCue; idx: number; t0: number } | null = null

    const show = (w: InsertWindow | null) => {
      const box = boxRef.current
      const vid = vidRef.current
      const img = imgRef.current
      if (!box || !vid || !img) return
      if (!w) {
        box.style.visibility = 'hidden'
        if (!vid.paused) vid.pause()
        return
      }
      const src = sourceById(editsRef.current.sources, w.sourceId)
      const url = src ? urlRef.current?.[src.refId] : undefined
      box.style.visibility = 'visible'
      const fit = w.fit === 'contain' ? 'contain' : 'cover'
      if (src?.mediaType === 'image') {
        vid.style.display = 'none'
        img.style.display = 'block'
        img.style.objectFit = fit
        if (url && img.src !== url) img.src = url
        return
      }
      img.style.display = 'none'
      vid.style.display = 'block'
      vid.style.objectFit = fit
      if (url && vid.src !== url) vid.src = url
      vid.muted = w.audio === 'mute'
      vid.currentTime = w.inMs / 1000
      void vid.play().catch(() => {})
    }

    const tick = () => {
      const v = videoRef.current
      const p = planRef.current
      if (v && p) {
        const cur = sourceMsFromVideo(v.currentTime, mediaOffsetMs)
        if (hold) {
          if (!v.paused) {
            // The user pressed play / seeked on the main video: drop the insert.
            hold = null
            show(null)
          } else {
            const w = hold.cue.windows[hold.idx]!
            if (performance.now() - hold.t0 >= w.durMs) {
              hold.idx += 1
              if (hold.idx < hold.cue.windows.length) {
                hold.t0 = performance.now()
                show(hold.cue.windows[hold.idx]!)
              } else {
                const resume = !hold.cue.append
                hold = null
                show(null)
                if (resume) void v.play().catch(() => {})
              }
            }
          }
        } else {
          const playing = !v.paused
          let cue: InsertCue | null = null
          if (playing && prevSrc != null) cue = crossedCue(p.cues, prevSrc, cur)
          if (!cue && wasPlaying && !playing && cur >= p.endSrcMs - 60) cue = p.cues.find((c) => c.append) ?? null
          if (cue) {
            if (playing) v.pause()
            hold = { cue, idx: 0, t0: performance.now() }
            show(cue.windows[0]!)
          }
          wasPlaying = playing
        }
        prevSrc = cur
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      show(null)
    }
  }, [plan, videoRef, mediaOffsetMs])

  if (!plan) return null
  return (
    <div
      ref={boxRef}
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden bg-black"
      style={{ visibility: 'hidden' }}
      data-testid="preview-insert"
    >
      <video ref={vidRef} data-own-clock="1" className="size-full object-cover" playsInline preload="auto" />
      <img ref={imgRef} alt="" className="hidden size-full object-cover" draggable={false} />
    </div>
  )
}
