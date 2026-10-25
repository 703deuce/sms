'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { CaptionPresetPicker } from '@/components/clips/caption-preset-picker'
import {
  clipAspectRatios,
  clipGenres,
  clipLayoutModes,
  clipLengthBuckets,
  clipModes,
  type ClipProjectSettings,
} from '@/lib/clips/settings'
import { cn } from '@/lib/utils'

const MODE_LABELS: Record<string, string> = {
  talking: 'Talking (podcast, interview)',
  anything: 'ClipAnything (any footage)',
  captions: 'Captions & reframe only',
}

const LAYOUT_LABELS: Record<string, string> = {
  speaker_follow: 'Speaker follow',
  split: 'Split screen',
  fill: 'Fill',
  fit: 'Fit with blur',
}

export function ProjectSettingsForm({
  settings,
  onChange,
  durationMs,
}: {
  settings: ClipProjectSettings
  onChange: (s: ClipProjectSettings) => void
  durationMs: number
}) {
  const end = settings.rangeEndMs || durationMs || 0
  const start = settings.rangeStartMs

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Mode & genre">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Clip mode</Label>
            <div className="flex flex-col gap-2">
              {clipModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...settings, mode })}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm surface',
                    settings.mode === mode ? 'border-primary' : 'border-border',
                  )}
                >
                  {MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            {settings.mode === 'anything' && (
              <p className="text-xs text-muted-foreground">Vision scan · about $0.07 per hour of video</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Genre</Label>
            <Select value={settings.genre} onValueChange={(v) => v && onChange({ ...settings, genre: v as ClipProjectSettings['genre'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {clipGenres.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Panel>

      <Panel title="Clip length & range">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {clipLengthBuckets.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onChange({ ...settings, clipLength: b })}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  settings.clipLength === b ? 'border-primary bg-accent' : 'border-border',
                )}
              >
                {b === 'auto' ? 'Auto' : b === 'lt30' ? '<30s' : b === '30_60' ? '30–60s' : '60–90s'}
              </button>
            ))}
          </div>
          {durationMs > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Processing range (ms)</Label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  className="rounded-md border px-2 py-1 text-sm"
                  value={start}
                  min={0}
                  max={end}
                  onChange={(e) => onChange({ ...settings, rangeStartMs: Number(e.target.value) })}
                />
                <input
                  type="number"
                  className="rounded-md border px-2 py-1 text-sm"
                  value={end}
                  min={start}
                  max={durationMs}
                  onChange={(e) => onChange({ ...settings, rangeEndMs: Number(e.target.value) })}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">Source {(durationMs / 1000).toFixed(1)}s</p>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Layout & aspect">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {clipLayoutModes.map((layout) => (
              <button
                key={layout}
                type="button"
                onClick={() => onChange({ ...settings, layout })}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm surface',
                  settings.layout === layout ? 'border-primary' : 'border-border',
                )}
              >
                {LAYOUT_LABELS[layout]}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Aspect ratio</Label>
            <Select
              value={settings.aspectRatio}
              onValueChange={(v) => v && onChange({ ...settings, aspectRatio: v as ClipProjectSettings['aspectRatio'] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {clipAspectRatios.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Panel>

      <Panel title="Captions">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="cap-on">Animated captions</Label>
            <Switch
              id="cap-on"
              checked={settings.captions.enabled}
              onCheckedChange={(v) => onChange({ ...settings, captions: { ...settings.captions, enabled: v } })}
            />
          </div>
          {settings.captions.enabled && (
            <CaptionPresetPicker
              value={settings.captions.presetId}
              onChange={(id) => onChange({ ...settings, captions: { ...settings.captions, presetId: id } })}
            />
          )}
        </div>
      </Panel>

      <Panel title="Prompt">
        <Textarea
          placeholder="Optional: moments about pricing, product launch, etc."
          value={settings.prompt || ''}
          onChange={(e) => onChange({ ...settings, prompt: e.target.value })}
          rows={3}
        />
      </Panel>
    </div>
  )
}
