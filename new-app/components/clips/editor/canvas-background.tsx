'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { MediaThumb } from '@/components/clips/editor/media-panel'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import { mediaUrlFor } from '@/components/clips/editor/use-project-media'
import { Section } from '@/components/clips/editor/properties-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { listProjectClips, patchClip } from '@/lib/clips-api'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  CANVAS_BG_LABELS,
  CANVAS_BG_SWATCHES,
  CANVAS_BG_TYPES,
  DEFAULT_CANVAS_COLOR,
  displayCanvasBgType,
  type CanvasBg,
  type CanvasBgType,
  withCanvasBg,
} from '@/lib/clips/canvas-bg'
import { FIT_BLUR_LABELS, FIT_BLUR_STRENGTHS, fitBlurStrength, type FitBlurStrength } from '@/lib/clips/fit-blur'
import { toast } from 'sonner'

const chipClass =
  'rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15 disabled:cursor-not-allowed disabled:opacity-50'

function bgToApply(edits: ClipEditsV2): CanvasBg {
  if (edits.canvasBg) return edits.canvasBg
  return { type: 'blur', blur: fitBlurStrength(edits) }
}

export function CanvasBackgroundControls({
  edits,
  onCommit,
  media,
  readOnly,
  compact,
  projectId,
  clipId,
  showApplyAll,
}: {
  edits: ClipEditsV2
  onCommit: (next: ClipEditsV2) => void
  media: ProjectMediaApi
  readOnly?: boolean
  compact?: boolean
  projectId?: string
  clipId?: string
  showApplyAll?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [hexDraft, setHexDraft] = useState('')
  const [lastColor, setLastColor] = useState(DEFAULT_CANVAS_COLOR)
  const fileRef = useRef<HTMLInputElement>(null)
  const displayType = displayCanvasBgType(edits)
  const activeType: CanvasBgType = edits.canvasBg?.type ?? 'blur'
  const images = useMemo(
    () => media.items.filter((i) => i.mediaType === 'image' && i.ref === 'upload'),
    [media.items],
  )
  const selectedImageId = edits.canvasBg?.type === 'image' ? edits.canvasBg.imageId : undefined
  const colorHex =
    edits.canvasBg?.type === 'color'
      ? edits.canvasBg.color ?? DEFAULT_CANVAS_COLOR
      : edits.canvasBg?.type === 'none'
        ? DEFAULT_CANVAS_COLOR
        : lastColor

  const commitType = useCallback(
    (t: CanvasBgType) => {
      if (readOnly) return
      if (t === 'none') onCommit(withCanvasBg(edits, { type: 'none' }))
      else if (t === 'blur') onCommit(withCanvasBg(edits, { type: 'blur', blur: fitBlurStrength(edits) }))
      else if (t === 'color') {
        const c = lastColor || DEFAULT_CANVAS_COLOR
        setLastColor(c)
        onCommit(withCanvasBg(edits, { type: 'color', color: c }))
      } else {
        if (selectedImageId) onCommit(withCanvasBg(edits, { type: 'image', imageId: selectedImageId }))
      }
    },
    [edits, lastColor, onCommit, readOnly, selectedImageId],
  )

  const commitColor = useCallback(
    (hex: string) => {
      if (readOnly) return
      setLastColor(hex)
      onCommit(withCanvasBg(edits, { type: 'color', color: hex }))
    },
    [edits, onCommit, readOnly],
  )

  const commitBlur = useCallback(
    (st: FitBlurStrength) => {
      if (readOnly) return
      onCommit(withCanvasBg(edits, { type: 'blur', blur: st }))
    },
    [edits, onCommit, readOnly],
  )

  const onPickImage = useCallback(
    (imageId: string) => {
      if (readOnly) return
      onCommit(withCanvasBg(edits, { type: 'image', imageId }))
    },
    [edits, onCommit, readOnly],
  )

  const onUpload = useCallback(
    async (files: FileList | null) => {
      if (readOnly || !files?.length) return
      setUploading(true)
      try {
        const created = await media.uploadFiles([files[0]!])
        const img = created.find((i) => i.mediaType === 'image') ?? created[0]
        if (img?.refId) onCommit(withCanvasBg(edits, { type: 'image', imageId: img.refId }))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [edits, media, onCommit, readOnly],
  )

  const applyToAll = useCallback(async () => {
    if (readOnly || !projectId || !clipId) return
    const payload = bgToApply(edits)
    try {
      const data = await listProjectClips(projectId, 'timeline')
      const clips = (data.clips ?? []) as { id: string }[]
      const others = clips.filter((c) => c.id && c.id !== clipId)
      if (!others.length) {
        toast.message('No other clips in this project')
        return
      }
      const n = others.length
      if (!window.confirm(`Apply this background to all ${n} clip${n === 1 ? '' : 's'} in this project?`)) return
      await Promise.all(
        others.map((c) =>
          patchClip(c.id, {
            edits: { canvasBg: payload },
          }),
        ),
      )
      toast.success(`Background applied to ${n} clip${n === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not apply to all clips')
    }
  }, [clipId, edits, projectId, readOnly])

  const typeControl = (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Background type">
      {CANVAS_BG_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          disabled={readOnly}
          aria-pressed={activeType === t}
          className={`flex-1 rounded px-1 py-1 text-[10px] font-medium disabled:opacity-40 ${activeType === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          onClick={() => commitType(t)}
        >
          {CANVAS_BG_LABELS[t]}
        </button>
      ))}
    </div>
  )

  const applyAllBtn =
    showApplyAll && projectId && clipId ? (
      <Button type="button" size="xs" variant="outline" disabled={readOnly} onClick={() => void applyToAll()} data-testid="canvas-bg-apply-all">
        Apply to all
      </Button>
    ) : null

  return (
    <div className={`space-y-3 ${compact ? '' : 'text-sm'}`} data-testid="canvas-bg-controls">
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Only shows where the video doesn&apos;t fill the frame.</p>
          {applyAllBtn}
        </div>
      ) : null}
      {typeControl}
      {activeType === 'color' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-1.5">
            {CANVAS_BG_SWATCHES.map((sw) => (
              <button
                key={sw}
                type="button"
                disabled={readOnly}
                aria-label={sw}
                className="aspect-square rounded border border-border"
                style={{ background: sw }}
                onClick={() => commitColor(sw)}
              />
            ))}
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded border border-dashed border-border text-[9px] text-muted-foreground">
              Custom
              <input
                type="color"
                className="sr-only"
                disabled={readOnly}
                value={colorHex}
                onChange={(e) => setHexDraft(e.target.value.toUpperCase())}
                onBlur={() => {
                  if (hexDraft && /^#[0-9A-Fa-f]{6}$/.test(hexDraft)) commitColor(hexDraft.toUpperCase())
                }}
              />
            </label>
          </div>
          <Input
            className="h-7 font-mono text-xs"
            disabled={readOnly}
            placeholder="#RRGGBB"
            value={hexDraft || colorHex}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={() => {
              const v = (hexDraft || colorHex).trim()
              if (/^#[0-9A-Fa-f]{6}$/.test(v)) commitColor(v.toUpperCase())
              else setHexDraft('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = (hexDraft || colorHex).trim()
                if (/^#[0-9A-Fa-f]{6}$/.test(v)) commitColor(v.toUpperCase())
                setHexDraft('')
              }
            }}
          />
        </div>
      ) : null}
      {activeType === 'blur' ? (
        <div className="flex flex-wrap gap-1.5">
          {FIT_BLUR_STRENGTHS.map((st) => (
            <Button
              key={st}
              type="button"
              size="sm"
              variant={fitBlurStrength(edits) === st ? 'default' : 'outline'}
              disabled={readOnly}
              onClick={() => commitBlur(st)}
            >
              {FIT_BLUR_LABELS[st]}
            </Button>
          ))}
        </div>
      ) : null}
      {activeType === 'image' ? (
        <div className="space-y-2">
          {images.length === 0 && !uploading ? (
            <p className="text-[11px] text-muted-foreground">Upload an image</p>
          ) : null}
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={readOnly}
                className={`overflow-hidden rounded ring-2 ${selectedImageId === item.refId ? 'ring-primary' : 'ring-transparent'}`}
                onClick={() => onPickImage(item.refId)}
              >
                <MediaThumb item={item} className="h-14 w-full" />
              </button>
            ))}
            <button
              type="button"
              disabled={readOnly || uploading}
              className="flex h-14 flex-col items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground"
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onUpload(e.target.files)} />
          {selectedImageId && !mediaUrlFor(media.items, selectedImageId) ? (
            <p className="text-[11px] text-amber-600">Image missing</p>
          ) : null}
        </div>
      ) : null}
      {compact && applyAllBtn ? <div className="flex justify-end border-t border-border pt-2">{applyAllBtn}</div> : null}
    </div>
  )
}

function chipLabel(edits: ClipEditsV2, media: ProjectMediaApi, narrow?: boolean): string {
  const t = displayCanvasBgType(edits)
  if (narrow && t === 'color') return 'BG: Color'
  return `Background: ${CANVAS_BG_LABELS[t]}`
}

export function CanvasBackgroundChip({
  edits,
  onCommit,
  media,
  readOnly,
  visible,
  compositeLocked,
  projectId,
  clipId,
  narrow,
}: {
  edits: ClipEditsV2
  onCommit: (next: ClipEditsV2) => void
  media: ProjectMediaApi
  readOnly?: boolean
  visible: boolean
  compositeLocked?: boolean
  projectId?: string
  clipId?: string
  narrow?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (!visible && !compositeLocked) return null
  const t = displayCanvasBgType(edits)
  const imageId = edits.canvasBg?.type === 'image' ? edits.canvasBg.imageId : undefined
  const imageUrl = imageId ? mediaUrlFor(media.items, imageId) : null
  const colorDot =
    t === 'color' ? (
      <span
        className="ml-1 inline-block size-2.5 rounded-full ring-1 ring-white/30"
        style={{ background: edits.canvasBg?.color ?? DEFAULT_CANVAS_COLOR }}
        aria-hidden
      />
    ) : t === 'image' && imageUrl ? (
      <img src={imageUrl} alt="" className="ml-1 inline-block size-2.5 rounded object-cover" aria-hidden />
    ) : null

  if (compositeLocked) {
    return (
      <span
        className={chipClass}
        data-testid="preview-canvas-bg-chip"
        title="Not available for this clip"
      >
        {chipLabel(edits, media, narrow)}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${chipClass} pointer-events-auto max-w-full shrink-0 truncate whitespace-nowrap`}
          data-testid="preview-canvas-bg-chip"
          disabled={readOnly}
          aria-label={chipLabel(edits, media, false)}
        >
          {chipLabel(edits, media, narrow)}
          {colorDot}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <CanvasBackgroundControls
          edits={edits}
          onCommit={(n) => {
            onCommit(n)
          }}
          media={media}
          readOnly={readOnly}
          compact
          projectId={projectId}
          clipId={clipId}
          showApplyAll
        />
      </PopoverContent>
    </Popover>
  )
}

export function CanvasBackgroundSection({
  edits,
  onCommit,
  media,
  readOnly,
  projectId,
  clipId,
  compositeLocked,
}: {
  edits: ClipEditsV2
  onCommit: (next: ClipEditsV2) => void
  media: ProjectMediaApi
  readOnly?: boolean
  projectId?: string
  clipId?: string
  compositeLocked?: boolean
}) {
  if (compositeLocked) {
    return (
      <Section title="Canvas background" testId="canvas-bg-section">
        <p className="text-xs text-muted-foreground">Not available for this clip</p>
      </Section>
    )
  }
  return (
    <Section title="Canvas background" testId="canvas-bg-section">
      <CanvasBackgroundControls
        edits={edits}
        onCommit={onCommit}
        media={media}
        readOnly={readOnly}
        projectId={projectId}
        clipId={clipId}
        showApplyAll
      />
    </Section>
  )
}
