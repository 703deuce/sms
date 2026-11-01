'use client'

import { useEffect, useRef } from 'react'
import { fontUrlsForAss, PREVIEW_SCRIPT_ORDER, type PreviewScriptKey, type PreviewScripts } from '@/lib/clips/render-plan/preview-scripts'
import { jassubOptions, loadJassub, type JassubInstance } from '@/lib/clips/editor/jassub-loader'

/** Output-time clock driven by PreviewStage's rAF tick (no React state per frame). */
export type LibassClock = { now: () => number; subscribe: (fn: (outputMs: number) => void) => () => void }
export type LibassLayerStatus = 'ready' | 'failed'
export type LibassStatusFn = (key: PreviewScriptKey, status: LibassLayerStatus, info: Record<string, unknown>) => void

const INIT_TIMEOUT_MS = 12000
// Same stacking as the export's burns: captions → hook → text items (z-25, in that DOM order), then
// title/headline + badge text above the DOM title band (z-26) and badge sprite (z-27).
const LAYER_Z: Record<PreviewScriptKey, string> = { captions: 'z-[25]', hook: 'z-[25]', text: 'z-[25]', top: 'z-[28]' }

function LibassLayer({
  layer,
  ass,
  playW,
  playH,
  clock,
  onStatus,
  z,
  layerId,
}: {
  layer: PreviewScriptKey
  ass: string
  playW: number
  playH: number
  clock: LibassClock
  onStatus: LibassStatusFn
  /** G1b: explicit z-index (under-text canvases between B-roll layers). */
  z?: number
  layerId?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instRef = useRef<JassubInstance | null>(null)
  const readyRef = useRef(false)
  const loadedFonts = useRef(new Set<string>())
  const assRef = useRef(ass)
  assRef.current = ass
  const dimsRef = useRef({ playW, playH })
  dimsRef.current = { playW, playH }
  const statusRef = useRef(onStatus)
  statusRef.current = onStatus

  const draw = (ms: number, repaint = false) => {
    const inst = instRef.current
    if (!inst || !readyRef.current) return Promise.resolve()
    const { playW: width, playH: height } = dimsRef.current
    return inst.manualRender({ mediaTime: ms / 1000, width, height, expectedDisplayTime: performance.now() }, repaint)
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let dead = false
    let unsub = () => {}
    const t0 = performance.now()
    // JASSUB transfers the canvas to its worker and removes it on destroy → keep it out of React.
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    canvas.setAttribute('data-testid', 'libass-canvas')
    canvas.setAttribute('data-libass-layer', layer)
    host.appendChild(canvas)
    const fail = (reason: string) => {
      if (dead) return
      dead = true
      statusRef.current(layer, 'failed', { reason })
    }
    const timer = setTimeout(() => {
      if (!readyRef.current) fail('init_timeout')
    }, INIT_TIMEOUT_MS)
    loadJassub()
      .then(async (JASSUB) => {
        if (dead) return
        const first = assRef.current
        const fonts = fontUrlsForAss(first)
        fonts.forEach((f) => loadedFonts.current.add(f))
        const inst = new JASSUB(jassubOptions(canvas, first, fonts))
        instRef.current = inst
        await inst.ready
        if (dead) return
        if (assRef.current !== first) await inst.renderer.setTrack(assRef.current)
        readyRef.current = true
        clearTimeout(timer)
        await draw(clock.now(), true)
        if (dead) return
        statusRef.current(layer, 'ready', { initMs: Math.round(performance.now() - t0), fonts: fonts.length })
        let last = -1
        unsub = clock.subscribe((ms) => {
          if (ms === last) return
          last = ms
          void draw(ms)
        })
      })
      .catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
    return () => {
      dead = true
      clearTimeout(timer)
      unsub()
      readyRef.current = false
      const inst = instRef.current
      instRef.current = null
      if (inst) void inst.destroy().catch(() => {})
      else canvas.remove()
    }
    // One instance per mounted layer; script changes go through setTrack below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer])

  useEffect(() => {
    const inst = instRef.current
    if (!inst || !readyRef.current) return
    let cancelled = false
    ;(async () => {
      const add = fontUrlsForAss(ass).filter((f) => !loadedFonts.current.has(f))
      if (add.length) {
        add.forEach((f) => loadedFonts.current.add(f))
        await inst.renderer.addFonts(add)
      }
      if (cancelled) return
      await inst.renderer.setTrack(ass)
      await draw(clock.now(), true)
    })().catch((err: unknown) => statusRef.current(layer, 'failed', { reason: `set_track:${String(err)}` }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ass])

  return (
    <div
      ref={hostRef}
      className={`pointer-events-none absolute inset-0 ${z == null ? LAYER_Z[layer] : ''}`}
      style={z == null ? undefined : { zIndex: z }}
      data-testid="libass-layer"
      data-libass-layer={layerId ?? layer}
      aria-hidden
    />
  )
}

/** EP2: one libass-wasm canvas per export burn that has content, stacked like the export. */
export function LibassPreviewLayers({
  scripts,
  playW,
  playH,
  clock,
  onStatus,
  fxHostRef,
}: {
  scripts: PreviewScripts
  playW: number
  playH: number
  clock: LibassClock
  onStatus: LibassStatusFn
  /** CV-17c: hosts for per-item text fx libass layers (mask / blend preview). */
  fxHostRef?: (id: string, el: HTMLDivElement | null) => void
}) {
  return (
    <>
      {(scripts.fx ?? []).map((f) => (
        <div
          key={f.key}
          ref={(el) => fxHostRef?.(f.id, el)}
          className="pointer-events-none absolute inset-0 z-[25]"
          data-testid="preview-text-fx"
          data-fx-id={f.id}
          aria-hidden
        >
          <LibassLayer layer="text" layerId={f.key} z={f.z} ass={f.ass} playW={playW} playH={playH} clock={clock} onStatus={onStatus} />
        </div>
      ))}
      {(scripts.under ?? []).map((u) => (
        <LibassLayer key={u.key} layer="text" layerId={u.key} z={u.z} ass={u.ass} playW={playW} playH={playH} clock={clock} onStatus={onStatus} />
      ))}
      {PREVIEW_SCRIPT_ORDER.map((k) =>
        scripts[k] ? (
          <LibassLayer key={k} layer={k} ass={scripts[k]!} playW={playW} playH={playH} clock={clock} onStatus={onStatus} />
        ) : null,
      )}
    </>
  )
}
