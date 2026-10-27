'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { isClipLayoutBeta } from '@/lib/clips/clipper-layout-beta'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipAspectRatios } from '@/lib/clips/settings'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import type { CropShot } from '@/lib/server/clips/clip-detail'

const LAYOUTS: { id: ClipEditsV2['layout']['mode']; title: string; desc: string; disabled?: boolean }[] = [
  { id: 'auto', title: 'Auto variety', desc: 'Rotate layouts per clip rank.' },
  { id: 'speaker_follow', title: 'Speaker follow', desc: 'Single active speaker.' },
  { id: 'dynamic', title: 'Dynamic', desc: 'Director picks per scene.' },
  { id: 'split', title: 'Split (2-up)', desc: 'Stacked two-person layout.' },
  { id: 'grid3', title: 'Grid 3-up', desc: 'Three speakers visible.' },
  { id: 'grid4', title: 'Grid 4-up', desc: 'Four speakers visible.' },
  { id: 'fit_blur', title: 'Fit with blur', desc: 'Letterbox with blurred fill.' },
  { id: 'center_crop', title: 'Fill', desc: 'Full-frame crop fill.' },
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
}: {
  edits: ClipEditsV2
  shots: CropShot[]
  onMode: (mode: ClipEditsV2['layout']['mode']) => void
  onShotFocus: (i: number, focus: 'auto' | 'A' | 'B' | 'both') => void
  onRerunReframe: (shotIndex: number) => void
  onApplyBrand?: () => void
  onEdits?: (edits: ClipEditsV2) => void
  reframeV2Enabled?: boolean
}) {
  const zoom = edits.zoom || { enabled: false, intensity: 1.08 }
  const silence = edits.silenceTrim || { enabled: false, minGapMs: 600, keepMs: 150 }
  return (
    <div className="flex flex-col gap-4">
      {onApplyBrand && (
        <Button type="button" size="sm" variant="outline" onClick={onApplyBrand}>
          Apply brand
        </Button>
      )}
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
      {onEdits && (
        <div className="space-y-3 rounded-lg border border-border p-3">
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
      <div className="grid gap-2 sm:grid-cols-2">
        {LAYOUTS.map((l) => {
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
      <ul className="divide-y divide-border rounded-lg border border-border">
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
    </div>
  )
}
