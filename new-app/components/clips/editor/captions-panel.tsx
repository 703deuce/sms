'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CaptionMiniPreview } from '@/components/clips/editor/caption-overlay'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { CAPTION_PRESETS, presetSlugToId, resolvePreset } from '@/lib/clips/caption-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { wordDisplayText } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { clipsFetch } from '@/lib/clips-api'
import { cn } from '@/lib/utils'

const ANIMATIONS = ['none', 'pop', 'bounce', 'slideup', 'typewriter', 'karaoke', 'glow'] as const

type CustomPreset = { id: string; name: string; config: Record<string, unknown> }

export function CaptionsPanel({
  clipId,
  edits,
  words = [],
  onWordFix,
  onChange,
  onApplyBrand,
  onSaveClipTemplate,
}: {
  clipId?: string
  edits: ClipEditsV2
  words?: SourceWord[]
  onWordFix?: (index: number, text: string) => void
  onChange: (captions: ClipEditsV2['captions']) => void
  onApplyBrand?: () => void
  onSaveClipTemplate?: () => void
}) {
  const cap = edits.captions ?? {}
  const [editingWordI, setEditingWordI] = useState<number | null>(null)
  const presetId = cap.presetId || 'bold_pop'
  const preset = resolvePreset(presetId)
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

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

  const activeWordsPerLine = Number(cap.wordsPerLine ?? preset.wordsPerLine)
  const activeCase = cap.case ?? preset.case
  const activePosition = cap.position ?? preset.position

  const suggestEmojis = async () => {
    if (!clipId) return
    try {
      const data = await clipsFetch<{ picks: { wordIndex: number; emoji: string }[] }>(
        `/api/clips/clips/${clipId}/captions/emojis`,
        { method: 'POST', body: '{}' },
      )
      const map: Record<string, string> = { ...(cap.emojiByWord || {}) }
      for (const p of data.picks) {
        map[String(p.wordIndex)] = p.emoji
      }
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

      {onWordFix && words.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3" data-testid="caption-word-corrections">
          <p className="text-xs font-medium text-muted-foreground">Caption text</p>
          <p className="text-[11px] text-muted-foreground">Double-click a word to fix spelling without re-timing.</p>
          <div className="max-h-40 overflow-y-auto text-sm leading-relaxed">
            {words.map((w) => {
              const display = wordDisplayText(w, edits.wordFixes)
              const fixed = Boolean(edits.wordFixes?.[String(w.i)]?.trim())
              if (editingWordI === w.i) {
                return (
                  <span key={w.i} className="mr-1 inline-flex">
                    <input
                      autoFocus
                      className="w-24 rounded border border-border bg-background px-1 py-0.5 text-sm"
                      defaultValue={display}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onWordFix(w.i, e.currentTarget.value)
                          setEditingWordI(null)
                        }
                        if (e.key === 'Escape') setEditingWordI(null)
                      }}
                      onBlur={(e) => {
                        onWordFix(w.i, e.target.value)
                        setEditingWordI(null)
                      }}
                    />
                  </span>
                )
              }
              return (
                <button
                  key={w.i}
                  type="button"
                  className={cn(
                    'mr-1 rounded px-0.5 hover:bg-accent',
                    fixed && 'bg-primary/15 ring-1 ring-primary/30',
                  )}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    setEditingWordI(w.i)
                  }}
                  title={fixed ? `Corrected from “${w.w}”` : 'Double-click to edit'}
                >
                  {display}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {customPresets.length > 0 ? (
        <div className="space-y-2" data-testid="caption-custom-presets">
          <p className="text-xs font-medium text-muted-foreground">My presets</p>
          <ul className="space-y-1">
            {customPresets.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <button
                  type="button"
                  className="flex-1 text-left text-xs font-medium hover:underline"
                  onClick={() =>
                    onChange({
                      ...cap,
                      customPresetId: p.id,
                      ...(p.config as ClipEditsV2['captions']),
                    })
                  }
                >
                  {p.name}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive"
                  onClick={async () => {
                    if (!window.confirm(`Delete preset "${p.name}"?`)) return
                    try {
                      await clipsFetch(`/api/clips/caption-presets/${p.id}`, { method: 'DELETE' })
                      if (cap.customPresetId === p.id) patch({ customPresetId: undefined })
                      await loadCustom()
                      toast.success('Preset deleted')
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Delete failed')
                    }
                  }}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
                  ...cap,
                  enabled: cap.enabled !== false,
                  presetId: id,
                  animation: p.animation,
                  size: cap.size ?? p.sizePct,
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
      <Select
        value={cap.animation || preset.animation || 'pop'}
        onValueChange={(v) => {
          if (typeof v === 'string') patch({ animation: v })
        }}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANIMATIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a === 'slideup' ? 'Slide up' : a === 'karaoke' ? 'Karaoke fill' : a.charAt(0).toUpperCase() + a.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center justify-between">
        <label htmlFor="cap-auto-emojis" className="text-sm">Auto emojis</label>
        <Switch id="cap-auto-emojis" checked={!!cap.autoEmojis} onCheckedChange={(v) => patch({ autoEmojis: v })} />
      </div>
      {cap.autoEmojis && clipId ? (
        <Button size="sm" variant="outline" onClick={() => void suggestEmojis()}>Suggest emojis</Button>
      ) : null}

      <div className="flex items-center justify-between">
        <label htmlFor="cap-progress-bar" className="text-sm">Progress bar</label>
        <Switch
          id="cap-progress-bar"
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
          <Slider
            className="min-w-[120px] flex-1"
            min={6}
            max={12}
            step={1}
            value={[cap.progressBar?.thickness || 8]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v
              patch({ progressBar: { ...cap.progressBar, enabled: true, thickness: typeof n === 'number' ? n : 8 } })
            }}
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
      <Slider
        min={3}
        max={10}
        step={0.5}
        value={[cap.size ?? preset.sizePct]}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v
          patch({ size: typeof n === 'number' ? n : preset.sizePct })
        }}
      />

      <div className="flex gap-2">
        {(['top', 'middle', 'bottom'] as const).map((pos) => (
          <Button
            key={pos}
            size="sm"
            variant={activePosition === pos ? 'default' : 'outline'}
            onClick={() => patch({ position: pos })}
          >
            {pos}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={activeCase === 'upper' ? 'default' : 'outline'}
          onClick={() => patch({ case: 'upper' })}
        >
          UPPER
        </Button>
        <Button
          size="sm"
          variant={activeCase === 'sentence' ? 'default' : 'outline'}
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
            variant={activeWordsPerLine === n ? 'default' : 'outline'}
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

      <div className="flex flex-wrap gap-2">
        {onApplyBrand ? (
          <Button size="sm" variant="outline" onClick={onApplyBrand}>Apply brand kit</Button>
        ) : null}
        {onSaveClipTemplate ? (
          <Button size="sm" variant="outline" onClick={onSaveClipTemplate}>Save clip template</Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>Save caption preset</Button>
      </div>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save caption preset</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Preset name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            autoFocus
          />
          <DialogFooter className="mt-2">
            <Button size="sm" variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={async () => {
                const name = saveName.trim()
                if (!name) {
                  toast.error('Enter a preset name')
                  return
                }
                try {
                  await clipsFetch('/api/clips/caption-presets', {
                    method: 'POST',
                    body: JSON.stringify({
                      name,
                      config: {
                        presetId: cap.presetId,
                        animation: cap.animation,
                        size: cap.size,
                        position: cap.position,
                        case: cap.case,
                        wordsPerLine: cap.wordsPerLine,
                        colors: cap.colors,
                        progressBar: cap.progressBar,
                        autoEmojis: cap.autoEmojis,
                      },
                    }),
                  })
                  toast.success('Preset saved')
                  setSaveName('')
                  setSaveOpen(false)
                  await loadCustom()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Save failed')
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
