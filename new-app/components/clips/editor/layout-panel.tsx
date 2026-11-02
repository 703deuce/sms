'use client'

import { useCallback, useEffect, useState } from 'react'
import { Scissors } from 'lucide-react'
import { FreeToolBadge } from '@/components/clips/ui/free-tool-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import { isClipLayoutBeta } from '@/lib/clips/clipper-layout-beta'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  layoutOptionDisabled,
  layoutPickPayload,
  visibleLayoutOptions,
} from '@/lib/clips/layout-options'
import {
  EXPORT_ASPECT_PRESETS,
  aspectLabel,
  customAspectDims,
  customAspectToken,
  exportPixelSize,
  isCustomAspect,
  type ExportAspect,
} from '@/lib/clips/export-aspect'
import { withCanvasBg } from '@/lib/clips/canvas-bg'
import { FIT_BLUR_LABELS, FIT_BLUR_STRENGTHS, fitBlurStrength } from '@/lib/clips/fit-blur'
import type { CropShot, FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import { applySplitScreenOnOverlap } from '@/lib/clips/editor/reframe-overlap'
import {
  ClipShortenGapsPanel,
  type ClipGapToolSettings,
} from '@/components/clips/editor/clip-shorten-gaps-panel'
import type { SourceWord } from '@/lib/clips/source-words'
import { FacecamLayoutStudio } from '@/components/clips/editor/facecam-layout-studio'
import { TemplateLayoutPanel } from '@/components/clips/editor/template-layout-panel'

export function LayoutPanel({
  edits,
  shots,
  onMode,
  onShotFocus,
  onRerunReframe,
  onApplyBrand,
  onEdits,
  reframeV2Enabled = false,
  onEditsPass,
  appliedLayoutLabel = null,
  clipId,
  words = [],
  clipStartMs = 0,
  clipEndMs = 0,
  gapToolSettings,
  onGapToolSettingsChange,
  onAddCut,
  onSetCutRanges,
  onSeekSource,
  onOpenGapReview,
  onOpenFillerReview,
  headlinePlatform,
  facecamLayout = null,
  onOpenLayersTab,
  videoUrl = null,
  posterUrl = null,
  projectId,
  channelId = null,
  clipType = null,
  mediaOffsetMs = 0,
  aiMeta = null,
  peaksUrl = null,
  onSeekShot,
}: {
  edits: ClipEditsV2
  shots: CropShot[]
  onMode: (
    mode: ClipEditsV2['layout']['mode'],
    facecam?: ClipEditsV2['layout']['facecam'],
  ) => void
  onShotFocus: (i: number, focus: 'auto' | 'A' | 'B' | 'both') => void
  onRerunReframe: (shotIndex: number) => void
  onSeekShot?: (sourceMs: number) => void
  onApplyBrand?: () => void
  onEdits?: (edits: ClipEditsV2) => void
  onEditsPass?: (edits: ClipEditsV2, label: string) => void
  reframeV2Enabled?: boolean
  /** Runtime layout from reframe (read-only inspector). */
  appliedLayoutLabel?: string | null
  clipId?: string
  words?: SourceWord[]
  clipStartMs?: number
  clipEndMs?: number
  gapToolSettings?: ClipGapToolSettings
  onOpenFillerReview?: () => void
  onGapToolSettingsChange?: (patch: Partial<ClipGapToolSettings>) => void
  onAddCut?: (range: [number, number]) => void
  onSetCutRanges?: (ranges: [number, number][]) => void
  onSeekSource?: (sourceMs: number) => void
  onOpenGapReview?: () => void
  headlinePlatform?: 'twitch' | 'kick'
  facecamLayout?: FacecamLayoutState | null
  onOpenLayersTab?: () => void
  videoUrl?: string | null
  posterUrl?: string | null
  projectId?: string
  channelId?: string | null
  clipType?: string | null
  mediaOffsetMs?: number
  aiMeta?: Record<string, unknown> | null
  peaksUrl?: string | null
}) {
  const zoom = edits.zoom || { enabled: false, intensity: 1.08 }
  const silence = edits.silenceTrim || { enabled: false, minGapMs: 600, keepMs: 150 }
  const aiExtras = clipEditorAiExtrasEnabled()
  const layoutOptions = visibleLayoutOptions({
    reframeV2Enabled,
    aiExtras,
    aspect: edits.aspectRatio ?? '9:16',
  })
  const currentAspect = edits.aspectRatio ?? '9:16'
  const customActive = isCustomAspect(currentAspect)
  const presetForCustom = EXPORT_ASPECT_PRESETS.includes(currentAspect as (typeof EXPORT_ASPECT_PRESETS)[number])
    ? (currentAspect as (typeof EXPORT_ASPECT_PRESETS)[number])
    : '9:16'
  const defaultCustom = exportPixelSize(
    customActive ? currentAspect : presetForCustom,
    '1080p',
  )
  const [customW, setCustomW] = useState(() =>
    customActive ? customAspectDims(currentAspect).width : defaultCustom.width,
  )
  const [customH, setCustomH] = useState(() =>
    customActive ? customAspectDims(currentAspect).height : defaultCustom.height,
  )
  const [customErr, setCustomErr] = useState<string | null>(null)
  useEffect(() => {
    if (customActive) {
      const d = customAspectDims(currentAspect)
      setCustomW(d.width)
      setCustomH(d.height)
      setCustomErr(null)
    }
  }, [currentAspect, customActive])
  const commitCustom = useCallback(() => {
    if (!onEdits) return
    const token = customAspectToken(customW, customH)
    if (!token) {
      setCustomErr('Even numbers, 240–3840, ratio up to 4:1')
      return
    }
    setCustomErr(null)
    onEdits({ ...edits, aspectRatio: token })
  }, [customH, customW, edits, onEdits])
  const enterCustom = useCallback(() => {
    if (!onEdits) return
    const px = exportPixelSize(presetForCustom, '1080p')
    setCustomW(px.width)
    setCustomH(px.height)
    setCustomErr(null)
    const token = customAspectToken(px.width, px.height)
    if (token) onEdits({ ...edits, aspectRatio: token })
  }, [edits, onEdits, presetForCustom])
  const export720 = customAspectToken(customW, customH)
    ? exportPixelSize(customAspectToken(customW, customH)!, '720p')
    : null
  const export1080 = customAspectToken(customW, customH)
    ? exportPixelSize(customAspectToken(customW, customH)!, '1080p')
    : null
  return (
    <div className="flex flex-col gap-4">
      {appliedLayoutLabel ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Detected layout: </span>
          <span className="font-medium text-foreground">{appliedLayoutLabel}</span>
        </div>
      ) : null}
      {onApplyBrand && (
        <Button type="button" size="sm" variant="outline" onClick={onApplyBrand}>
          Apply brand
        </Button>
      )}
      {onEdits && (edits.layout.shotOverrides?.length ?? 0) > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onEdits({ ...edits, layout: { ...edits.layout, shotOverrides: [] } })}
        >
          Reset shot overrides to AI
        </Button>
      ) : null}
      {onEdits && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label className="text-xs font-medium">Aspect ratio</Label>
          <div className="flex flex-wrap gap-2">
            {EXPORT_ASPECT_PRESETS.map((a) => (
              <Button
                key={a}
                type="button"
                size="sm"
                variant={currentAspect === a ? 'default' : 'outline'}
                data-testid={`aspect-${a}`}
                onClick={() => onEdits({ ...edits, aspectRatio: a })}
              >
                {a}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={customActive ? 'default' : 'outline'}
              data-testid="aspect-custom"
              onClick={enterCustom}
            >
              Custom
            </Button>
          </div>
          {customActive ? (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">W</Label>
                  <input
                    type="number"
                    min={240}
                    max={3840}
                    step={2}
                    className="block w-24 rounded border border-border bg-background px-2 py-1 text-sm"
                    data-testid="aspect-custom-w"
                    value={customW}
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    onBlur={commitCustom}
                    onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
                  />
                </div>
                <Button type="button" size="sm" variant="outline" data-testid="aspect-custom-swap" onClick={() => {
                  setCustomW(customH)
                  setCustomH(customW)
                }}>
                  ↔
                </Button>
                <div>
                  <Label className="text-[10px] text-muted-foreground">H</Label>
                  <input
                    type="number"
                    min={240}
                    max={3840}
                    step={2}
                    className="block w-24 rounded border border-border bg-background px-2 py-1 text-sm"
                    data-testid="aspect-custom-h"
                    value={customH}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    onBlur={commitCustom}
                    onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
                  />
                </div>
              </div>
              {customErr ? <p className="text-xs text-destructive">{customErr}</p> : null}
              {export1080 && export720 ? (
                <p className="text-xs text-muted-foreground">
                  Exports at {export1080.width}×{export1080.height} (1080p) / {export720.width}×{export720.height} (720p)
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Updates the preview and export framing.</p>
        </div>
      )}
      {onEdits && (
        <div className="space-y-2 rounded-lg border border-border p-3" data-testid="layout-blur-strength">
          <Label className="text-xs font-medium">Background blur</Label>
          {edits.canvasBg && edits.canvasBg.type !== 'blur' ? (
            <p className="text-xs text-muted-foreground">
              Background is set to Color/Image. Choose a blur strength to switch back to Blur.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {FIT_BLUR_STRENGTHS.map((st) => (
              <Button
                key={st}
                type="button"
                size="sm"
                variant={fitBlurStrength(edits) === st ? 'default' : 'outline'}
                aria-pressed={fitBlurStrength(edits) === st}
                onClick={() =>
                  onEdits(
                    edits.canvasBg
                      ? withCanvasBg(edits, { type: 'blur', blur: st })
                      : { ...edits, layout: { ...edits.layout, blurStrength: st } },
                  )
                }
              >
                {FIT_BLUR_LABELS[st]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Fills the space around fitted video and blurred bands.</p>
        </div>
      )}
      {onOpenLayersTab ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          <p className="text-muted-foreground">Headline, platform badge, and follow sticker live in Layers.</p>
          <Button type="button" size="sm" variant="link" className="h-auto px-0" onClick={onOpenLayersTab}>
            Open Layers
          </Button>
        </div>
      ) : null}
      {onOpenFillerReview ? (
        <Button type="button" size="sm" variant="outline" className="w-full gap-1.5" onClick={onOpenFillerReview}>
          <Scissors className="size-3.5" aria-hidden />
          Remove filler words
          <FreeToolBadge />
        </Button>
      ) : null}
      {clipId && words.length > 0 && gapToolSettings && onGapToolSettingsChange && onAddCut && onSeekSource && onOpenGapReview ? (
        <div className="rounded-lg border border-border">
          <ClipShortenGapsPanel
            clipId={clipId}
            words={words}
            edits={edits}
            clipStartMs={clipStartMs}
            clipEndMs={clipEndMs}
            settings={gapToolSettings}
            onSettingsChange={onGapToolSettingsChange}
            onAddCut={onAddCut}
            onSetCutRanges={onSetCutRanges}
            onSeek={onSeekSource}
            onOpenReview={onOpenGapReview}
            videoUrl={videoUrl}
            peaksUrl={peaksUrl}
          />
        </div>
      ) : null}
      {onEdits && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Export-only (no preview)</p>
          {aiExtras ? (
            <>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Auto zoom on emphasis</Label>
            <Switch
              checked={Boolean(zoom.enabled)}
              aria-checked={Boolean(zoom.enabled)}
              aria-label="Auto zoom on emphasis"
              onCheckedChange={(checked) =>
                onEdits({ ...edits, zoom: { ...zoom, enabled: Boolean(checked) } })
              }
            />
          </div>
          {zoom.enabled && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Intensity {(zoom.intensity ?? 1.08).toFixed(2)}
              </Label>
              <Slider
                min={1}
                max={1.12}
                step={0.02}
                value={[zoom.intensity ?? 1.08]}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : v
                  if (typeof n === 'number') onEdits({ ...edits, zoom: { ...zoom, intensity: n } })
                }}
              />
            </div>
          )}
            </>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Silence trim on export</Label>
            <Switch
              checked={Boolean(silence.enabled)}
              aria-checked={Boolean(silence.enabled)}
              aria-label="Silence trim on export"
              onCheckedChange={(checked) =>
                onEdits({ ...edits, silenceTrim: { ...silence, enabled: Boolean(checked) } })
              }
            />
          </div>
          {edits.captions?.autoEmojis ? (
            <p className="text-xs text-muted-foreground">
              Emoji captions are enabled{edits.captions.keywordHighlight ? ' with keyword emphasis' : ''}.
            </p>
          ) : null}
          {silence.enabled && (
            <label className="flex items-center gap-2 text-xs">
              Min gap (ms)
              <input
                type="number"
                className="w-20 rounded border px-1"
                value={silence.minGapMs ?? 600}
                onChange={(e) =>
                  onEdits({
                    ...edits,
                    silenceTrim: { ...silence, minGapMs: Number(e.target.value) },
                  })
                }
              />
            </label>
          )}
        </div>
      )}
      {(() => {
        const savedFacecamMode =
          edits.layout.mode === 'facecam_stack' || edits.layout.mode === 'facecam_pip'
        if (!savedFacecamMode || facecamLayout?.facecam || edits.layout.facecam?.box) return null
        const label =
          edits.layout.mode === 'facecam_stack' ? 'Facecam stack' : 'Facecam PiP'
        return (
          <p className="text-xs text-muted-foreground" role="note">
            No facecam detected — drag the Facecam box onto the webcam in the layout editor below.
          </p>
        )
      })()}
      {layoutOptions.some((l) => l.id === 'facecam_stack' || l.id === 'facecam_pip') &&
      !facecamLayout?.facecam &&
      !edits.layout.facecam?.box ? (
        <p className="text-xs text-muted-foreground" role="note">
          No facecam detected — drag the Facecam box onto the webcam in the layout editor below.
        </p>
      ) : null}
      {onEdits ? (
        <TemplateLayoutPanel
          edits={edits}
          onEdits={onEdits}
          aiMeta={aiMeta}
          videoUrl={videoUrl}
          posterUrl={posterUrl}
        />
      ) : null}
      {onEdits ? (
        <FacecamLayoutStudio
          edits={edits}
          facecamLayout={facecamLayout}
          onEdits={onEdits}
          videoUrl={videoUrl}
          posterUrl={posterUrl}
          projectId={projectId}
          channelId={channelId}
          clipType={clipType}
          sourceTimeSec={(edits.trim.in - mediaOffsetMs) / 1000}
          aiMeta={aiMeta}
        />
      ) : null}
      {layoutOptions.length > 0 ? (
      <div className="grid gap-2 sm:grid-cols-2">
        {layoutOptions.map((l) => {
          const beta = isClipLayoutBeta(l.id)
          const disabled = layoutOptionDisabled(l, { facecamLayout, reframeV2Enabled, aiExtras })
          const selected = edits.layout.mode === l.id && !disabled
          return (
          <button
            key={l.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              const payload = layoutPickPayload(l.id, facecamLayout, edits)
              onMode(payload.mode, payload.facecam)
            }}
            className={`rounded-lg border p-3 text-left ${
              selected ? 'border-primary ring-1 ring-primary' : 'border-border'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <p className="text-sm font-medium">
              {l.title}
              {beta ? <span className="ml-1 text-xs font-normal text-muted-foreground">(beta)</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{l.hint}</p>
          </button>
          )
        })}
      </div>
      ) : null}
      {aiExtras ? (
      <>
      <p className="text-xs text-muted-foreground">
        Shots are time ranges from auto reframe. Pick who to follow at each speaker switch; use Re-run after large transcript edits.
      </p>
      {onEdits && shots.length ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-xs" data-testid="reframe-split-fallback">
          <div>
            <p className="font-medium">Split-screen on overlap</p>
            <p className="text-muted-foreground">When two speakers talk at once, follow both-wide on those shots (v1 crop).</p>
          </div>
          <Switch
            checked={Boolean(edits.layout.splitScreenFallback)}
            onCheckedChange={(on) => {
              const next = applySplitScreenOnOverlap(edits, shots, on === true)
              if (onEditsPass) onEditsPass(next, on ? 'Reframe: split on overlap' : 'Reframe: split off')
              else onEdits?.(next)
            }}
          />
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {shots.length === 0 ? (
          <li className="p-3 text-sm text-muted-foreground">No shot list yet — save or re-run reframe to load segments.</li>
        ) : null}
        {shots.map((shot, i) => {
          const focus =
            edits.layout.shotOverrides.find((s) => s.i === i)?.focus ?? 'auto'
          return (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" data-testid={`reframe-shot-${i}`}>
              <div>
                <button
                  type="button"
                  className="text-left font-medium underline-offset-2 hover:underline"
                  onClick={() => onSeekShot?.(shot.startMs)}
                >
                  {(shot.startMs / 1000).toFixed(1)}s – {(shot.endMs / 1000).toFixed(1)}s (source)
                </button>
                <p className="text-xs text-muted-foreground">Auto speaker {shot.speaker}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Focus on</span>
                <Select
                  value={focus}
                  onValueChange={(v) => {
                    if (typeof v === 'string') onShotFocus(i, v as 'auto' | 'A' | 'B' | 'both')
                  }}
                >
                  <SelectTrigger size="sm" className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="A">Speaker A</SelectItem>
                    <SelectItem value="B">Speaker B</SelectItem>
                    <SelectItem value="both">Both-wide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={() => onRerunReframe(i)}>Re-run auto reframe</Button>
            </li>
          )
        })}
      </ul>
      </>
      ) : null}
    </div>
  )
}
