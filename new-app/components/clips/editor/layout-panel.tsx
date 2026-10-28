'use client'

import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import { isClipLayoutBeta } from '@/lib/clips/clipper-layout-beta'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipAspectRatios } from '@/lib/clips/settings'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import {
  ClipShortenGapsPanel,
  type ClipGapToolSettings,
} from '@/components/clips/editor/clip-shorten-gaps-panel'
import type { SourceWord } from '@/lib/clips/source-words'

const LAYOUTS: { id: ClipEditsV2['layout']['mode']; title: string; desc: string; disabled?: boolean }[] = [
  { id: 'auto', title: 'Auto variety', desc: 'Rotate layouts per clip rank.' },
  { id: 'speaker_follow', title: 'Speaker follow', desc: 'Single active speaker.' },
  { id: 'dynamic', title: 'Dynamic', desc: 'Director picks per scene.' },
  { id: 'split', title: 'Split (2-up)', desc: 'Stacked two-person layout.' },
  { id: 'grid3', title: 'Grid 3-up', desc: 'Three speakers visible.' },
  { id: 'grid4', title: 'Grid 4-up', desc: 'Four speakers visible.' },
  { id: 'fit_blur', title: 'Fit with blur', desc: 'Whole shot letterboxed with blurred fill (no headline band).' },
  {
    id: 'fit_top',
    title: 'Headline + video',
    desc: 'CLIPZ-style: white headline band, full-width 16:9 video, blur footer.',
  },
  {
    id: 'full_frame',
    title: 'Full frame',
    desc: 'Whole 16:9 stream shot, blur fill, headline room on export (no face tracking).',
  },
  { id: 'center_crop', title: 'Fill', desc: 'Full-frame crop fill.' },
  {
    id: 'screen_pip',
    title: 'Screen + camera',
    desc: 'Screen share full frame with speaker PiP (when detected).',
  },
  { id: 'subject_follow', title: 'Subject follow', desc: 'ClipAnything — later', disabled: true },
]

export function LayoutPanel({
  edits,
  shots,
  onMode,
  onShotFocus,
  onRerunReframe,
  onApplyBrand,
  onEdits,
  reframeV2Enabled = false,
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
}: {
  edits: ClipEditsV2
  shots: CropShot[]
  onMode: (mode: ClipEditsV2['layout']['mode']) => void
  onShotFocus: (i: number, focus: 'auto' | 'A' | 'B' | 'both') => void
  onRerunReframe: (shotIndex: number) => void
  onApplyBrand?: () => void
  onEdits?: (edits: ClipEditsV2) => void
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
}) {
  const zoom = edits.zoom || { enabled: false, intensity: 1.08 }
  const silence = edits.silenceTrim || { enabled: false, minGapMs: 600, keepMs: 150 }
  const aiExtras = clipEditorAiExtrasEnabled()
  const layoutOptions = LAYOUTS.filter((l) => {
    if (l.disabled) return aiExtras
    if (isClipLayoutBeta(l.id) && !reframeV2Enabled) return aiExtras
    return true
  })
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
            {clipAspectRatios.map((a) => (
              <Button
                key={a}
                type="button"
                size="sm"
                variant={(edits.aspectRatio ?? '9:16') === a ? 'default' : 'outline'}
                onClick={() => onEdits({ ...edits, aspectRatio: a as ExportAspect })}
              >
                {a}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Updates the preview and export framing.</p>
        </div>
      )}
      {onOpenFillerReview ? (
        <Button type="button" size="sm" variant="outline" className="w-full gap-1.5" onClick={onOpenFillerReview}>
          <Scissors className="size-3.5" aria-hidden />
          Remove filler words
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
      {layoutOptions.length > 0 ? (
      <div className="grid gap-2 sm:grid-cols-2">
        {layoutOptions.map((l) => {
          const beta = isClipLayoutBeta(l.id)
          const disabled = l.disabled || (beta && !reframeV2Enabled)
          return (
          <button
            key={l.id}
            type="button"
            disabled={disabled}
            onClick={() => onMode(l.id)}
            className={`rounded-lg border p-3 text-left ${
              edits.layout.mode === l.id ? 'border-primary ring-1 ring-primary' : 'border-border'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <p className="text-sm font-medium">
              {l.title}
              {beta ? <span className="ml-1 text-xs font-normal text-muted-foreground">(beta)</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{l.desc}</p>
          </button>
          )
        })}
      </div>
      ) : null}
      {aiExtras ? (
      <>
      <p className="text-xs text-muted-foreground">
        Shots are time ranges from auto reframe. Pick who to follow per shot; use Re-run after large transcript edits.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {shots.length === 0 ? (
          <li className="p-3 text-sm text-muted-foreground">No shot list yet — save or re-run reframe to load segments.</li>
        ) : null}
        {shots.map((shot, i) => {
          const focus =
            edits.layout.shotOverrides.find((s) => s.i === i)?.focus ?? 'auto'
          return (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium">
                  {(shot.startMs / 1000).toFixed(1)}s – {(shot.endMs / 1000).toFixed(1)}s (source)
                </p>
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
