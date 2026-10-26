'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CaptionMiniPreview } from '@/components/clips/editor/caption-overlay'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CAPTION_PRESETS, presetSlugToId, resolvePreset } from '@/lib/clips/caption-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import { cn } from '@/lib/utils'

const ANIMATIONS = ['none', 'pop', 'bounce', 'slideup', 'typewriter', 'karaoke', 'glow'] as const

type CustomPreset = { id: string; name: string; config: Record<string, unknown> }

export function CaptionsPanel({
  clipId,
  edits,
  onChange,
  onSavePreset,
  onApplyBrand,
}: {
  clipId?: string
  edits: ClipEditsV2
  onChange: (captions: ClipEditsV2['captions']) => void
  onSavePreset?: () => void
  onApplyBrand?: () => void
}) {
  const cap = edits.captions ?? {}
  const presetId = cap.presetId || 'bold_pop'
  const preset = resolvePreset(presetId)
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([])

  const loadCustom = useCallback(async () => {
    try {
      const data = await clipsFetch<{ items: CustomPreset[] }>('/api/clips/caption-presets')
      setCustomPresets(data.items)
    } catch {
      setCustomPresets([])
    }
  }, [])

  useEffect(() => {
    void loadCustom()
  }, [loadCustom])

  const patch = (partial: Partial<ClipEditsV2['captions']>) => onChange({ ...cap, ...partial })

  const suggestEmojis = async () => {
    if (!clipId) return
    try {
      const data = await clipsFetch<{ picks: { wordIndex: number; emoji: string }[] }>(
        `/api/clips/clips/${clipId}/captions/emojis`,
        { method: 'POST', body: '{}' },
      )
      const map: Record<string, string> = { ...(cap.emojiByWord || {}) }
      for (const p of data.picks) map[String(p.wordIndex)] = p.emoji
      patch({ autoEmojis: true, emojiByWord: map })
      toast.success(`Added ${data.picks.length} emoji(s)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Emoji suggest failed')
    }
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Captions</span>
        <Switch checked={cap.enabled !== false} onCheckedChange={(v) => patch({ enabled: v })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {customPresets.map((p) => {
          const active = cap.customPresetId === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onChange({
                  ...cap,
                  customPresetId: p.id,
                  presetId: 'bold_pop',
                  presetConfig: p.config,
                })
              }
              className={cn(
                'rounded-lg border p-2 text-left transition-colors',
                active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/40',
              )}
            >
              <p className="mb-1 text-xs font-medium">{p.name}</p>
              <span className="text-[10px] text-muted-foreground">Custom</span>
            </button>
          )
        })}
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
        <span className="text-sm">Auto emojis</span>
        <Switch checked={!!cap.autoEmojis} onCheckedChange={(v) => patch({ autoEmojis: v })} />
      </div>
      {cap.autoEmojis && clipId ? (
        <Button size="sm" variant="outline" onClick={() => void suggestEmojis()}>Suggest emojis</Button>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-sm">Progress bar</span>
        <Switch
          checked={!!cap.progressBar?.enabled}
          onCheckedChange={(v) =>
            patch({
              progressBar: {
                enabled: v,
                color: cap.progressBar?.color || '#FFFFFF',
                position: cap.progressBar?.position || 'bottom',
                thickness: cap.progressBar?.thickness || 8,
              },
            })
          }
        />
      </div>
      {cap.progressBar?.enabled ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <input
            type="color"
            value={cap.progressBar?.color || '#FFFFFF'}
            onChange={(e) => patch({ progressBar: { ...cap.progressBar, enabled: true, color: e.target.value } })}
          />
          {(['top', 'bottom'] as const).map((pos) => (
            <Button
              key={pos}
              size="sm"
              variant={cap.progressBar?.position === pos ? 'default' : 'outline'}
              onClick={() => patch({ progressBar: { ...cap.progressBar, enabled: true, position: pos } })}
            >
              {pos}
            </Button>
          ))}
          <input
            type="range"
            min={6}
            max={12}
            value={cap.progressBar?.thickness || 8}
            onChange={(e) =>
              patch({ progressBar: { ...cap.progressBar, enabled: true, thickness: Number(e.target.value) } })
            }
          />
        </div>
      ) : null}

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

      {onApplyBrand ? (
        <Button size="sm" variant="outline" onClick={onApplyBrand}>Apply brand</Button>
      ) : null}
      {onSavePreset ? (
        <Button size="sm" variant="outline" onClick={onSavePreset}>Save as preset</Button>
      ) : null}
    </div>
  )
}
