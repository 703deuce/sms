'use client'

import { CaptionMiniPreview } from '@/components/clips/editor/caption-overlay'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CAPTION_PRESETS, presetSlugToId, resolvePreset } from '@/lib/clips/caption-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { cn } from '@/lib/utils'

const ANIMATIONS = ['none', 'pop', 'bounce', 'slideup', 'typewriter', 'karaoke', 'glow'] as const

export function CaptionsPanel({
  edits,
  onChange,
  onSavePreset,
}: {
  edits: ClipEditsV2
  onChange: (captions: ClipEditsV2['captions']) => void
  onSavePreset?: () => void
}) {
  const cap = edits.captions ?? {}
  const presetId = cap.presetId || 'bold_pop'
  const preset = resolvePreset(presetId)

  const patch = (partial: Partial<ClipEditsV2['captions']>) => onChange({ ...cap, ...partial })

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Captions</span>
        <Switch checked={cap.enabled !== false} onCheckedChange={(v) => patch({ enabled: v })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CAPTION_PRESETS.map((p) => {
          const id = presetSlugToId(p.slug)
          const active = id === presetId
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() =>
                onChange({
                  enabled: cap.enabled !== false,
                  presetId: id,
                  animation: p.animation,
                  size: p.sizePct,
                  position: p.position,
                  case: p.case,
                  wordsPerLine: p.wordsPerLine,
                  keywordHighlight: cap.keywordHighlight,
                  emphasis: cap.keywordHighlight ? cap.emphasis : undefined,
                })
              }
              className={cn(
                'rounded-lg border p-2 text-left transition-colors',
                active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/40',
              )}
            >
              <p className="mb-1 text-xs font-medium">{p.name}</p>
              <CaptionMiniPreview preset={p} />
            </button>
          )
        })}
      </div>

      <label className="text-xs font-medium text-muted-foreground">Animation</label>
      <select
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        value={cap.animation || preset.animation}
        onChange={(e) => patch({ animation: e.target.value })}
      >
        {ANIMATIONS.map((a) => (
          <option key={a} value={a}>
            {a === 'slideup' ? 'Slide up' : a === 'karaoke' ? 'Karaoke fill' : a.charAt(0).toUpperCase() + a.slice(1)}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between">
        <span className="text-sm">Keyword highlight</span>
        <Switch
          checked={!!cap.keywordHighlight}
          onCheckedChange={(v) => patch({ keywordHighlight: v, emphasis: v ? cap.emphasis ?? [] : [] })}
        />
      </div>

      <label className="text-xs font-medium text-muted-foreground">
        Size ({cap.size ?? preset.sizePct}% of video height)
      </label>
      <input
        type="range"
        min={3}
        max={10}
        step={0.5}
        value={cap.size ?? preset.sizePct}
        onChange={(e) => patch({ size: Number(e.target.value) })}
        className="w-full"
      />

      <div className="flex gap-2">
        {(['top', 'middle', 'bottom'] as const).map((pos) => (
          <Button
            key={pos}
            size="sm"
            variant={(cap.position || preset.position) === pos ? 'default' : 'outline'}
            onClick={() => patch({ position: pos })}
          >
            {pos}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={(cap.case || preset.case) === 'upper' ? 'default' : 'outline'}
          onClick={() => patch({ case: 'upper' })}
        >
          UPPER
        </Button>
        <Button
          size="sm"
          variant={(cap.case || preset.case) === 'sentence' ? 'default' : 'outline'}
          onClick={() => patch({ case: 'sentence' })}
        >
          Sentence
        </Button>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <Button
            key={n}
            size="sm"
            variant={(cap.wordsPerLine ?? preset.wordsPerLine) === n ? 'default' : 'outline'}
            onClick={() => patch({ wordsPerLine: n })}
          >
            {n} / line
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">
          Speaker 1 active
          <input
            type="color"
            className="mt-1 block h-8 w-full"
            value={cap.colors?.a || preset.active}
            onChange={(e) => patch({ colors: { ...cap.colors, a: e.target.value } })}
          />
        </label>
        <label className="text-xs">
          Speaker 2 active
          <input
            type="color"
            className="mt-1 block h-8 w-full"
            value={cap.colors?.b || preset.activeB}
            onChange={(e) => patch({ colors: { ...cap.colors, b: e.target.value } })}
          />
        </label>
      </div>

      {onSavePreset ? (
        <Button size="sm" variant="outline" onClick={onSavePreset}>Save as preset</Button>
      ) : null}
    </div>
  )
}
