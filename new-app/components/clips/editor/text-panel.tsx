'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { reconcileItemMotion } from '@/lib/clips/editor/keyframes'
import {
  DEFAULT_TEXT_STYLE,
  newTextItem,
  normalizeTextItems,
  TEXT_FONTS,
  TEXT_MAX_CHARS,
  TEXT_MAX_ITEMS,
  TEXT_PRESETS,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  type TextAlign,
  type TextItem,
  type TextStyle,
} from '@/lib/clips/editor/text-items'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { TextAnimSection } from '@/components/clips/editor/text-anim-section'
import { coalescePush, type CoalesceBurst } from '@/lib/clips/editor/undo-coalesce'

const ALIGNS: TextAlign[] = ['left', 'center', 'right']

/** Blank text would drop the item (normalizeTextItems), so blanks stay local until blur reverts them. */
function TextContent({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <Textarea
      value={draft}
      maxLength={TEXT_MAX_CHARS}
      onChange={(e) => {
        setDraft(e.target.value)
        if (e.target.value.trim()) onCommit(e.target.value)
      }}
      onBlur={() => {
        if (!draft.trim()) setDraft(value)
      }}
      className="min-h-[60px] text-sm"
      data-testid="text-content"
    />
  )
}

function fontCss(font: string) {
  return captionFontStack(font === 'Montserrat' ? 'Montserrat Black' : font)
}

function ColorField({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-6 w-10 cursor-pointer rounded border border-border bg-transparent"
        data-testid={testId}
      />
    </label>
  )
}

/**
 * E4 Text (CapCut Text tab): "Add text" at the playhead, a preset grid (the 4 T6 title styles first,
 * then E4 presets), and the inspector for the selected item. Timing is edited on the Text lane
 * (move / trim / split / delete); motion with the timeline keyframe inspector (target text:<id>).
 */
export function TextPanel({
  edits,
  onEdits,
  playheadMs,
  durationMs,
  selectedId,
  onSelect,
  onLive,
}: {
  edits: ClipEditsV2
  /** pushHistory=false folds the change into the current undo step (E4fix coalescing). */
  onEdits: (e: ClipEditsV2, pushHistory?: boolean) => void
  playheadMs: number
  durationMs: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** E4fix: slider drags preview live (audition) and commit once on release, like the Color panel. */
  onLive?: (e: ClipEditsV2 | null) => void
}) {
  const items = edits.textItems ?? []
  const sel = items.find((t) => t.id === selectedId) ?? null
  const burst = useRef<CoalesceBurst | null>(null)

  // reconcileItemMotion: a moved item carries its text:<id> keyframes, a deleted one drops them.
  const build = (list: TextItem[]) =>
    reconcileItemMotion(edits, { ...edits, textItems: normalizeTextItems(list, durationMs) })
  /** `key` = the control; a burst on one control (typing, slider keys, color drag) is one undo step. */
  const write = (list: TextItem[], key?: string) => {
    const next = build(list)
    if (!key || !sel) {
      burst.current = null
      onEdits(next)
      return
    }
    const now = Date.now()
    const push = coalescePush(burst.current, `${sel.id}:${key}`, now, JSON.stringify(sel))
    const after = next.textItems?.find((t) => t.id === sel.id)
    burst.current = { key: `${sel.id}:${key}`, at: now, sig: JSON.stringify(after ?? null) }
    onEdits(next, push)
  }
  const patch = (p: Partial<TextItem>, key?: string) =>
    sel && write(items.map((t) => (t.id === sel.id ? { ...t, ...p } : t)), key)
  const patchStyle = (p: Partial<TextStyle>, key?: string) => sel && patch({ style: { ...sel.style, ...p } }, key)
  const livePatch = (p: Partial<TextItem>) =>
    sel && onLive?.(build(items.map((t) => (t.id === sel.id ? { ...t, ...p } : t))))
  const liveStyle = (p: Partial<TextStyle>) => sel && livePatch({ style: { ...sel.style, ...p } })
  const commitPatch = (p: Partial<TextItem>, key: string) => {
    onLive?.(null)
    patch(p, key)
  }
  const commitStyle = (p: Partial<TextStyle>, key: string) => {
    onLive?.(null)
    patchStyle(p, key)
  }

  const add = (presetId = 'basic') => {
    if (items.length >= TEXT_MAX_ITEMS) return
    const id = `t${Date.now().toString(36)}`
    const it = newTextItem(id, playheadMs, durationMs, presetId)
    write([...items, it])
    onSelect(id)
  }

  return (
    <div className="space-y-4 p-3 text-sm" data-testid="text-panel">
      <Button className="w-full gap-1.5" size="sm" onClick={() => add()} data-testid="text-add" disabled={items.length >= TEXT_MAX_ITEMS}>
        <Plus className="size-4" aria-hidden />
        Add text at playhead
      </Button>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Styles</p>
        <div className="grid grid-cols-3 gap-2">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`text-preset-${p.id}`}
              title={sel ? `Apply ${p.label} to the selected text` : `Add ${p.label} text`}
              className={cn(
                'grid h-14 place-items-center overflow-hidden rounded-lg border bg-black/80 px-1 text-[13px]',
                sel?.presetId === p.id ? 'border-primary ring-2 ring-primary/20' : 'border-border',
              )}
              onClick={() => (sel ? patch({ style: { ...p.style }, presetId: p.id }) : add(p.id))}
            >
              <span
                style={{
                  fontFamily: fontCss(p.style.font),
                  fontWeight: TEXT_FONTS.find((f) => f.id === p.style.font)?.weight,
                  color: p.style.color,
                  WebkitTextStroke: p.style.stroke ? `1px ${p.style.stroke.color}` : undefined,
                  background: p.style.box ? p.style.box.color : undefined,
                  padding: p.style.box ? '0 4px' : undefined,
                  textTransform: p.style.case === 'upper' ? 'uppercase' : undefined,
                }}
              >
                {p.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {items.length ? (
        <section className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this clip</p>
          <ul className="space-y-1" data-testid="text-list">
            {items.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs',
                    t.id === selectedId ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                  onClick={() => onSelect(t.id === selectedId ? null : t.id)}
                  data-testid={`text-list-item-${t.id}`}
                >
                  <span className="truncate">{t.text.split('\n')[0]}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {(t.startMs / 1000).toFixed(1)}–{(t.endMs / 1000).toFixed(1)}s
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sel ? (
        <section className="space-y-3 border-t pt-3" data-testid="text-inspector">
          <TextContent key={sel.id} value={sel.text} onCommit={(text) => patch({ text }, 'text')} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Font</Label>
              <Select value={sel.style.font} onValueChange={(v) => v && patchStyle({ font: v as TextStyle['font'] })}>
                <SelectTrigger className="h-8 text-xs" data-testid="text-font">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_FONTS.map((f) => (
                    <SelectItem key={f.id} value={f.id} data-testid={`text-font-${f.id}`}>
                      <span style={{ fontFamily: fontCss(f.id), fontWeight: f.weight }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Align</Label>
              <div role="radiogroup" className="flex rounded-md border border-border" data-testid="text-align" data-value={sel.style.align}>
                {ALIGNS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={sel.style.align === a}
                    className={cn('h-8 flex-1 text-[11px] capitalize', sel.style.align === a && 'bg-accent text-foreground')}
                    onClick={() => patchStyle({ align: a })}
                    data-testid={`text-align-${a}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <SliderRow label="Size" value={sel.style.size} min={TEXT_SIZE_MIN} max={TEXT_SIZE_MAX} testId="text-size" onLive={(v) => liveStyle({ size: v })} onCommit={(v) => commitStyle({ size: v }, 'size')} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <ColorField label="Color" value={sel.style.color} onChange={(c) => patchStyle({ color: c }, 'color')} testId="text-color" />
            <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              UPPERCASE
              <Switch checked={sel.style.case === 'upper'} onCheckedChange={(c) => patchStyle({ case: c ? 'upper' : 'none' })} data-testid="text-upper" />
            </label>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 p-2">
            <label className="flex items-center justify-between text-xs">
              Stroke
              <Switch
                checked={Boolean(sel.style.stroke)}
                onCheckedChange={(c) => patchStyle({ stroke: c ? sel.style.stroke ?? DEFAULT_TEXT_STYLE.stroke : undefined })}
                data-testid="text-stroke"
              />
            </label>
            {sel.style.stroke ? (
              <>
                <ColorField label="Stroke color" value={sel.style.stroke.color} onChange={(c) => patchStyle({ stroke: { ...sel.style.stroke!, color: c } }, 'stroke-color')} testId="text-stroke-color" />
                <SliderRow label="Width" value={sel.style.stroke.width} min={1} max={24} testId="text-stroke-width" onLive={(v) => liveStyle({ stroke: { ...sel.style.stroke!, width: v } })} onCommit={(v) => commitStyle({ stroke: { ...sel.style.stroke!, width: v } }, 'stroke-width')} />
              </>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-border/60 p-2">
            <label className="flex items-center justify-between text-xs">
              Shadow
              <Switch
                checked={Boolean(sel.style.shadow)}
                onCheckedChange={(c) => patchStyle({ shadow: c ? sel.style.shadow ?? { color: '#000000', opacity: 70, dist: 6 } : undefined })}
                data-testid="text-shadow"
              />
            </label>
            {sel.style.shadow ? (
              <>
                <ColorField label="Shadow color" value={sel.style.shadow.color} onChange={(c) => patchStyle({ shadow: { ...sel.style.shadow!, color: c } }, 'shadow-color')} testId="text-shadow-color" />
                <SliderRow label="Distance" value={sel.style.shadow.dist} min={1} max={24} testId="text-shadow-dist" onLive={(v) => liveStyle({ shadow: { ...sel.style.shadow!, dist: v } })} onCommit={(v) => commitStyle({ shadow: { ...sel.style.shadow!, dist: v } }, 'shadow-dist')} />
                <SliderRow label="Opacity" value={sel.style.shadow.opacity} min={0} max={100} unit="%" testId="text-shadow-opacity" onLive={(v) => liveStyle({ shadow: { ...sel.style.shadow!, opacity: v } })} onCommit={(v) => commitStyle({ shadow: { ...sel.style.shadow!, opacity: v } }, 'shadow-opacity')} />
              </>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-border/60 p-2">
            <label className="flex items-center justify-between text-xs">
              Background box
              <Switch
                checked={Boolean(sel.style.box)}
                onCheckedChange={(c) => patchStyle({ box: c ? sel.style.box ?? { color: '#000000', opacity: 80, pad: 16 } : undefined })}
                data-testid="text-box"
              />
            </label>
            {sel.style.box ? (
              <>
                <ColorField label="Box color" value={sel.style.box.color} onChange={(c) => patchStyle({ box: { ...sel.style.box!, color: c } }, 'box-color')} testId="text-box-color" />
                <SliderRow label="Opacity" value={sel.style.box.opacity} min={0} max={100} unit="%" testId="text-box-opacity" onLive={(v) => liveStyle({ box: { ...sel.style.box!, opacity: v } })} onCommit={(v) => commitStyle({ box: { ...sel.style.box!, opacity: v } }, 'box-opacity')} />
                <SliderRow label="Padding" value={sel.style.box.pad} min={0} max={80} testId="text-box-pad" onLive={(v) => liveStyle({ box: { ...sel.style.box!, pad: v } })} onCommit={(v) => commitStyle({ box: { ...sel.style.box!, pad: v } }, 'box-pad')} />
              </>
            ) : null}
          </div>

          <TextAnimSection
            anim={sel.anim}
            onChange={(anim, key) => {
              onLive?.(null)
              patch({ anim }, key)
            }}
            onLive={(anim) => livePatch({ anim })}
          />

          <SliderRow label="Position X" value={sel.x} min={0} max={100} unit="%" testId="text-x" onLive={(v) => livePatch({ x: v })} onCommit={(v) => commitPatch({ x: v }, 'x')} />
          <SliderRow label="Position Y" value={sel.y} min={0} max={100} unit="%" testId="text-y" onLive={(v) => livePatch({ y: v })} onCommit={(v) => commitPatch({ y: v }, 'y')} />
          <p className="text-[11px] text-muted-foreground">
            Timing: drag / trim it on the Text lane. Move it with keyframes: select it on the timeline.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-destructive"
            data-testid="text-delete"
            onClick={() => {
              write(items.filter((t) => t.id !== sel.id))
              onSelect(null)
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete text
          </Button>
        </section>
      ) : null}
    </div>
  )
}
