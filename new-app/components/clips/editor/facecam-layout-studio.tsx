'use client'

import { useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipTypeBadge } from '@/lib/clips/clip-results-chips'
import { coverBoxStyle, stackPanelStyles, DEFAULT_FACECAM_BOX, DEFAULT_GAMEPLAY_BOX, defaultUploadCropBox } from '@/lib/clips/facecam-geometry'
import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'
import { T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'

type NormBox = { x: number; y: number; w: number; h: number }

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

const MIN_BOX = 0.04
const FACECAM_LAYOUT_MODES = new Set(['facecam_stack', 'facecam_pip', 'screen_pip'])
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

function defaultFacecam(): NormBox {
  return { ...DEFAULT_FACECAM_BOX }
}

function defaultGameplay(): NormBox {
  return { ...DEFAULT_GAMEPLAY_BOX }
}

type DragKind = 'move' | 'resize' | null
type BoxTarget = 'face' | 'game' | 'crop'

function seekVideoToClip(e: React.SyntheticEvent<HTMLVideoElement>, sourceTimeSec: number) {
  const el = e.currentTarget
  if (Number.isFinite(sourceTimeSec) && sourceTimeSec >= 0) {
    el.currentTime = sourceTimeSec + 0.5
  }
}

function resizeBox(origin: NormBox, dx: number, dy: number, corner: ResizeCorner): NormBox {
  let { x, y, w, h } = origin
  if (corner === 'se') {
    w = clamp01(Math.max(MIN_BOX, w + dx))
    h = clamp01(Math.max(MIN_BOX, h + dy))
  } else if (corner === 'sw') {
    const nw = clamp01(Math.max(MIN_BOX, w - dx))
    x = clamp01(origin.x + (origin.w - nw))
    w = nw
    h = clamp01(Math.max(MIN_BOX, h + dy))
  } else if (corner === 'ne') {
    w = clamp01(Math.max(MIN_BOX, w + dx))
    const nh = clamp01(Math.max(MIN_BOX, h - dy))
    y = clamp01(origin.y + (origin.h - nh))
    h = nh
  } else {
    const nw = clamp01(Math.max(MIN_BOX, w - dx))
    const nh = clamp01(Math.max(MIN_BOX, h - dy))
    x = clamp01(origin.x + (origin.w - nw))
    y = clamp01(origin.y + (origin.h - nh))
    w = nw
    h = nh
  }
  x = Math.min(x, 1 - w)
  y = Math.min(y, 1 - h)
  return { x, y, w, h }
}

export function FacecamLayoutStudio({
  edits,
  facecamLayout,
  onEdits,
  videoUrl,
  posterUrl,
  projectId,
  channelId,
  clipType,
  sourceTimeSec = 0,
}: {
  edits: ClipEditsV2
  facecamLayout: FacecamLayoutState | null
  onEdits: (edits: ClipEditsV2) => void
  videoUrl: string | null
  posterUrl?: string | null
  projectId?: string
  channelId?: string | null
  clipType?: string | null
  sourceTimeSec?: number
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
    mode === 'split' ||
    mode === 'speaker_follow' ||
    mode === 'auto'

  const fc = edits.layout.facecam
  const faceBox = fc?.box ?? facecamLayout?.facecam ?? defaultFacecam()
  const gameBox = fc?.gameplay ?? facecamLayout?.gameplay ?? defaultGameplay()
  const split = fc?.split ?? facecamLayout?.split ?? 0.35
  const position = fc?.position ?? facecamLayout?.facecamPosition ?? 'top'
  const cropBox = edits.layout.cropBox ?? defaultUploadCropBox()
  // T6.2: with a T6 template the template's panel sources decide which boxes are editable.
  const t6Tpl = edits.layout.template?.id ? T6_TEMPLATES_BY_ID[edits.layout.template.id] : undefined
  const t6Srcs = t6Tpl ? t6Tpl.panels.map((p) => String(p.src)) : []
  const t6UsesCrop = t6Srcs.some((s) => s === 'action_box' || s === 'action_box_widened' || s === 'trim_sides')
  // T6.3: under a template, each box is shown only when the template's geometry reads it
  // (G6/C1 face_tight centres on the face inside the Facecam box; G3 reads the Gameplay box).
  // Before, the boxes followed layout.mode (facecam_stack for G6) so dragging them changed
  // nothing in the preview.
  const t6UsesFaceBox =
    Boolean(t6Tpl?.pip) ||
    t6Srcs.some((s) => s === 'facecam_box' || s === 'face_tight' || s === 'active_speaker')
  const t6UsesGameBox = t6Srcs.includes('gameplay_box')
  const t6UsesFacecam = t6UsesFaceBox || t6UsesGameBox
  const showFaceBox = t6Tpl ? t6UsesFaceBox : mode === 'facecam_stack' || mode === 'facecam_pip'
  const showGameBox = t6Tpl ? t6UsesGameBox : mode === 'facecam_stack' || mode === 'facecam_pip'
  const showCropBox = t6Tpl
    ? t6UsesCrop
    : mode === 'center_crop' || mode === 'fill' || mode === 'speaker_follow' || mode === 'auto'
  const t6PersonFraming = Boolean(t6Tpl) && t6Srcs.some((s) => s.startsWith('person:'))
  const wholeFrameHint = t6Tpl
    ? !t6UsesCrop && !t6UsesFacecam
    : mode === 'fit_blur' || mode === 'fit_top' || mode === 'full_frame'
  const clipTypeLabel = clipTypeBadge(clipType ? { clipType } : null)

  const sourceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    kind: DragKind
    target: BoxTarget
    corner: ResizeCorner
    startX: number
    startY: number
    origin: NormBox
  } | null>(null)

  const patchFacecam = useCallback(
    (patch: Partial<NonNullable<ClipEditsV2['layout']['facecam']>>) => {
      // T6.2: never flip the layout mode under an active template (it drives the template render).
      const nextMode = FACECAM_LAYOUT_MODES.has(mode) || edits.layout.template?.id ? mode : 'facecam_stack'
      onEdits({
        ...edits,
        layout: {
          ...edits.layout,
          mode: nextMode,
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
    [edits, faceBox, gameBox, split, position, fc?.pipCorner, mode, onEdits],
  )

  const patchCrop = useCallback(
    (next: NormBox) => {
      onEdits({
        ...edits,
        layout: {
          ...edits.layout,
          // T6.2: keep the template's mode; the crop box feeds its action_box/trim_sides panel.
          mode: edits.layout.template?.id ? edits.layout.mode : 'center_crop',
          cropBox: next,
        },
      })
    },
    [edits, onEdits],
  )

  const onPointerDown = (
    e: React.PointerEvent,
    target: BoxTarget,
    kind: DragKind,
    corner: ResizeCorner = 'se',
  ) => {
    if (!kind) return
    e.preventDefault()
    e.stopPropagation()
    const box = target === 'face' ? faceBox : target === 'game' ? gameBox : cropBox
    dragRef.current = { kind, target, corner, startX: e.clientX, startY: e.clientY, origin: { ...box } }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const host = sourceRef.current
    if (!drag || !host) return
    const rect = host.getBoundingClientRect()
    const dx = (e.clientX - drag.startX) / rect.width
    const dy = (e.clientY - drag.startY) / rect.height
    const o = drag.origin
    let next: NormBox
    if (drag.kind === 'move') {
      next = { ...o }
      next.x = clamp01(o.x + dx)
      next.y = clamp01(o.y + dy)
      next.x = Math.min(next.x, 1 - o.w)
      next.y = Math.min(next.y, 1 - o.h)
    } else {
      next = resizeBox(o, dx, dy, drag.corner)
    }
    if (drag.target === 'face') patchFacecam({ box: next })
    else if (drag.target === 'game') patchFacecam({ gameplay: next })
    else patchCrop(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragRef.current = null
  }

  const stackPreview = mode === 'facecam_stack' && !t6Tpl ? stackPanelStyles(split, position) : null

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
      <p className="text-xs font-medium text-foreground">
        Layout editor{clipTypeLabel ? ` · ${clipTypeLabel}` : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        Drag boxes on the 16:9 source; 9:16 preview matches export (per-clip edits only).
      </p>
      <div className="grid gap-3">
        <div
          ref={sourceRef}
          className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-black"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {videoUrl ? (
            <video
              src={videoUrl}
              className="absolute inset-0 h-full w-full object-contain"
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => seekVideoToClip(e, sourceTimeSec)}
            />
          ) : posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
          )}
          {wholeFrameHint ? (
            <p className="pointer-events-none absolute bottom-2 inset-x-2 z-10 text-center text-[10px] text-white/90 drop-shadow">
              {t6PersonFraming
                ? 'Framing follows the detected person (whole frame when nobody is detected).'
                : 'Whole frame is used.'}
            </p>
          ) : null}
          {showGameBox ? (
            <BoxOverlay
              label="Gameplay"
              box={gameBox}
              color="border-sky-400/80"
              zClass="z-10"
              onMove={(e) => onPointerDown(e, 'game', 'move')}
              onResizeCorner={(e, corner) => onPointerDown(e, 'game', 'resize', corner)}
              onPointerUp={onPointerUp}
            />
          ) : null}
          {showFaceBox ? (
            <BoxOverlay
              label="Facecam"
              box={faceBox}
              color="border-amber-400/80"
              zClass="z-20"
              onMove={(e) => onPointerDown(e, 'face', 'move')}
              onResizeCorner={(e, corner) => onPointerDown(e, 'face', 'resize', corner)}
              onPointerUp={onPointerUp}
            />
          ) : null}
          {showCropBox ? (
            <BoxOverlay
              label="Crop"
              box={cropBox}
              color="border-emerald-400/80"
              zClass="z-[15]"
              onMove={(e) => onPointerDown(e, 'crop', 'move')}
              onResizeCorner={(e, corner) => onPointerDown(e, 'crop', 'resize', corner)}
              onPointerUp={onPointerUp}
            />
          ) : null}
        </div>
        <div
          className="relative mx-auto aspect-[9/16] w-[120px] overflow-hidden rounded-md border border-border bg-black"
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
                  preload="auto"
                  onLoadedMetadata={(e) => seekVideoToClip(e, sourceTimeSec)}
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
                  preload="auto"
                  onLoadedMetadata={(e) => seekVideoToClip(e, sourceTimeSec)}
                />
              </div>
            </>
          ) : videoUrl ? (
            <video
              src={videoUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => seekVideoToClip(e, sourceTimeSec)}
            />
          ) : null}
        </div>
      </div>
      {(t6Tpl ? t6UsesFacecam : mode === 'facecam_stack' || mode === 'facecam_pip') && (
        <>
          {/* T6.3: templates have fixed panel proportions — split/swap only drive legacy stacks. */}
          {!t6Tpl ? (
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
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!facecamLayout?.facecam) return
                const detected = {
                  box: facecamLayout.facecam,
                  gameplay: facecamLayout.gameplay ?? undefined,
                  split: facecamLayout.split ?? 0.35,
                  position: facecamLayout.facecamPosition ?? 'top',
                }
                if (t6Tpl && t6UsesCrop && edits.layout.cropBox) {
                  // T6.4: under a template the game panel (G1/G2/G6 action_box_widened) reads the
                  // user's Crop box; "Snap to detected" resets it too, back to the detected game
                  // region. Legacy stacks have no crop box in this view, so they are unchanged.
                  onEdits({
                    ...edits,
                    layout: {
                      ...edits.layout,
                      cropBox: undefined,
                      facecam: { ...(fc ?? {}), ...detected, pipCorner: fc?.pipCorner },
                    },
                  })
                  return
                }
                patchFacecam(detected)
              }}
              disabled={!facecamLayout?.facecam}
              data-testid="studio-snap-detected"
              title="Reset the facecam and game framing to the detected layout"
            >
              Snap to detected
            </Button>
            {!t6Tpl ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => patchFacecam({ position: position === 'top' ? 'bottom' : 'top' })}
            >
              Swap stack (face bottom)
            </Button>
            ) : null}
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

const CORNERS: { corner: ResizeCorner; className: string; cursor: string }[] = [
  { corner: 'nw', className: '-left-1.5 -top-1.5', cursor: 'cursor-nwse-resize' },
  { corner: 'ne', className: '-right-1.5 -top-1.5', cursor: 'cursor-nesw-resize' },
  { corner: 'sw', className: '-left-1.5 -bottom-1.5', cursor: 'cursor-nesw-resize' },
  { corner: 'se', className: '-right-1.5 -bottom-1.5', cursor: 'cursor-nwse-resize' },
]

function BoxOverlay({
  label,
  box,
  color,
  zClass,
  onMove,
  onResizeCorner,
  onPointerUp,
}: {
  label: string
  box: NormBox
  color: string
  zClass: string
  onMove: (e: React.PointerEvent) => void
  onResizeCorner: (e: React.PointerEvent, corner: ResizeCorner) => void
  onPointerUp: (e: React.PointerEvent) => void
}) {
  return (
    <div
      className={`absolute border-2 ${color} bg-black/10 ${zClass}`}
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-move"
        aria-label={`Move ${label} region`}
        data-testid={`studio-box-${label.toLowerCase()}`}
        onPointerDown={onMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {CORNERS.map(({ corner, className, cursor }) => (
        <button
          key={corner}
          type="button"
          className={`absolute z-10 size-3 rounded-sm bg-background/90 ${className} ${cursor}`}
          aria-label={`Resize ${label} region ${corner}`}
          onPointerDown={(e) => onResizeCorner(e, corner)}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      ))}
      <span className="pointer-events-none absolute left-1 top-0.5 z-[1] text-[10px] font-medium text-white drop-shadow">
        {label}
      </span>
    </div>
  )
}
