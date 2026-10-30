'use client'

import { useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { coverBoxStyle, stackPanelStyles } from '@/lib/clips/facecam-geometry'
import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

type NormBox = { x: number; y: number; w: number; h: number }

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function defaultFacecam(): NormBox {
  return { x: 0.02, y: 0.02, w: 0.32, h: 0.28 }
}

function defaultGameplay(): NormBox {
  return { x: 0, y: 0, w: 1, h: 0.72 }
}

type DragKind = 'move' | 'resize' | null
type BoxTarget = 'face' | 'game'

export function FacecamLayoutStudio({
  edits,
  facecamLayout,
  onEdits,
  videoUrl,
  posterUrl,
  projectId,
  channelId,
  clipType,
}: {
  edits: ClipEditsV2
  facecamLayout: FacecamLayoutState | null
  onEdits: (edits: ClipEditsV2) => void
  videoUrl: string | null
  posterUrl?: string | null
  projectId?: string
  channelId?: string | null
  clipType?: string | null
}) {
  const mode = edits.layout.mode
  const showStudio =
    mode === 'facecam_stack' ||
    mode === 'facecam_pip' ||
    mode === 'screen_pip' ||
    mode === 'fit_blur' ||
    mode === 'fit_top' ||
    mode === 'full_frame' ||
    mode === 'center_crop' ||
    mode === 'fill' ||
    mode === 'split'

  const fc = edits.layout.facecam
  const faceBox = fc?.box ?? facecamLayout?.facecam ?? defaultFacecam()
  const gameBox = fc?.gameplay ?? facecamLayout?.gameplay ?? defaultGameplay()
  const split = fc?.split ?? facecamLayout?.split ?? 0.35
  const position = fc?.position ?? facecamLayout?.facecamPosition ?? 'top'

  const sourceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    kind: DragKind
    target: BoxTarget
    startX: number
    startY: number
    origin: NormBox
  } | null>(null)

  const patchFacecam = useCallback(
    (patch: Partial<NonNullable<ClipEditsV2['layout']['facecam']>>) => {
      onEdits({
        ...edits,
        layout: {
          ...edits.layout,
          facecam: {
            box: faceBox,
            split,
            position,
            gameplay: gameBox,
            pipCorner: fc?.pipCorner,
            ...patch,
          },
        },
      })
    },
    [edits, faceBox, gameBox, split, position, fc?.pipCorner, onEdits],
  )

  const onPointerDown = (e: React.PointerEvent, target: BoxTarget, kind: DragKind) => {
    if (!kind) return
    e.preventDefault()
    const box = target === 'face' ? faceBox : gameBox
    dragRef.current = { kind, target, startX: e.clientX, startY: e.clientY, origin: { ...box } }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const host = sourceRef.current
    if (!drag || !host) return
    const rect = host.getBoundingClientRect()
    const dx = (e.clientX - drag.startX) / rect.width
    const dy = (e.clientY - drag.startY) / rect.height
    const o = drag.origin
    let next: NormBox = { ...o }
    if (drag.kind === 'move') {
      next.x = clamp01(o.x + dx)
      next.y = clamp01(o.y + dy)
      next.x = Math.min(next.x, 1 - o.w)
      next.y = Math.min(next.y, 1 - o.h)
    } else {
      next.w = clamp01(Math.max(0.08, o.w + dx))
      next.h = clamp01(Math.max(0.08, o.h + dy))
      next.x = Math.min(o.x, 1 - next.w)
      next.y = Math.min(o.y, 1 - next.h)
    }
    if (drag.target === 'face') patchFacecam({ box: next })
    else patchFacecam({ gameplay: next })
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const stackPreview = mode === 'facecam_stack' ? stackPanelStyles(split, position) : null

  const saveChannelDefault = async () => {
    if (!projectId || !channelId) {
      toast.error('Connect a channel on this stream project to save a default.')
      return
    }
    const ct = (clipType || 'other').toLowerCase()
    try {
      await clipsFetch(`/api/clips/projects/${projectId}/clip-type-layout`, {
        method: 'POST',
        body: JSON.stringify({
          channelId,
          clipType: ct,
          layoutMode: edits.layout.mode,
          facecam: {
            box: faceBox,
            gameplay: gameBox,
            split,
            position,
            pipCorner: fc?.pipCorner,
          },
          makeDefault: true,
        }),
      })
      toast.success(`Saved default layout for ${ct} on this channel`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save channel default')
    }
  }

  if (!showStudio) return null

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-foreground">Layout editor</p>
      <p className="text-xs text-muted-foreground">
        Drag boxes on the 16:9 source; 9:16 preview matches export (per-clip edits only).
      </p>
      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <div
          ref={sourceRef}
          className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-black"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {videoUrl ? (
            <video
              src={videoUrl}
              poster={posterUrl ?? undefined}
              className="absolute inset-0 h-full w-full object-contain"
              muted
              playsInline
              preload="metadata"
            />
          ) : posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
          )}
          {(mode === 'facecam_stack' || mode === 'facecam_pip') && (
            <>
              <BoxOverlay
                label="Gameplay"
                box={gameBox}
                color="border-sky-400/80"
                onMove={(e) => onPointerDown(e, 'game', 'move')}
                onResize={(e) => onPointerDown(e, 'game', 'resize')}
              />
              <BoxOverlay
                label="Facecam"
                box={faceBox}
                color="border-amber-400/80"
                onMove={(e) => onPointerDown(e, 'face', 'move')}
                onResize={(e) => onPointerDown(e, 'face', 'resize')}
              />
            </>
          )}
        </div>
        <div
          className="relative mx-auto aspect-[9/16] w-full max-w-[120px] overflow-hidden rounded-md border border-border bg-black"
          aria-label="9:16 export preview"
        >
          {videoUrl && stackPreview ? (
            <>
              <div
                className="absolute inset-x-0 overflow-hidden"
                style={{ top: 0, height: `${stackPreview.faceFrac * 100}%` }}
              >
                <video
                  src={videoUrl}
                  className="h-full w-full"
                  style={coverBoxStyle(faceBox)}
                  muted
                  playsInline
                  preload="metadata"
                />
              </div>
              <div
                className="absolute inset-x-0 overflow-hidden"
                style={{ bottom: 0, height: `${stackPreview.gameFrac * 100}%` }}
              >
                <video
                  src={videoUrl}
                  className="h-full w-full"
                  style={coverBoxStyle(gameBox)}
                  muted
                  playsInline
                  preload="metadata"
                />
              </div>
            </>
          ) : videoUrl ? (
            <video src={videoUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          ) : null}
        </div>
      </div>
      {(mode === 'facecam_stack' || mode === 'facecam_pip') && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Stack split — top panel {Math.round(split * 100)}% (20–50%)</Label>
            <Slider
              min={20}
              max={50}
              value={[Math.round(split * 100)]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] ?? 35 : 35
                patchFacecam({ split: n / 100 })
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!facecamLayout?.facecam) return
                patchFacecam({
                  box: facecamLayout.facecam,
                  gameplay: facecamLayout.gameplay ?? undefined,
                  split: facecamLayout.split ?? 0.35,
                  position: facecamLayout.facecamPosition ?? 'top',
                })
              }}
              disabled={!facecamLayout?.facecam}
            >
              Snap to detected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => patchFacecam({ position: position === 'top' ? 'bottom' : 'top' })}
            >
              Swap stack (face bottom)
            </Button>
            {projectId && channelId ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => void saveChannelDefault()}>
                Save as default for channel
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function BoxOverlay({
  label,
  box,
  color,
  onMove,
  onResize,
}: {
  label: string
  box: NormBox
  color: string
  onMove: (e: React.PointerEvent) => void
  onResize: (e: React.PointerEvent) => void
}) {
  return (
    <div
      className={`absolute border-2 ${color} bg-black/10`}
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-move"
        aria-label={`Move ${label} region`}
        onPointerDown={onMove}
      />
      <button
        type="button"
        className="absolute bottom-0 right-0 size-4 cursor-se-resize rounded-sm bg-background/80"
        aria-label={`Resize ${label} region`}
        onPointerDown={onResize}
      />
      <span className="pointer-events-none absolute left-1 top-0.5 text-[10px] font-medium text-white drop-shadow">
        {label}
      </span>
    </div>
  )
}
