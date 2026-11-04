'use client'

import { GripVertical, Eye, EyeOff, Lock, Unlock, Loader2 } from 'lucide-react'
import { orderedStack, moveInStack } from '@/lib/clips/editor/layer-props'
import { toggleItemsEnabled } from '@/lib/clips/editor/item-flags'
import { setLaneState, laneState } from '@/lib/clips/editor/clip-timeline'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { HeadlineLayer, BadgeLayer, Layer, StickerLayer } from '@/lib/clips/layers'
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'
import { EditorHeadlineField } from '@/components/clips/editor/editor-headline-field'
import { t6TitleAutoEnabled } from '@/lib/clips/t6-feature-flags'
import { useSafeZoneVisible } from '@/lib/clips/use-safe-zone-visible'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const HEADLINE_PRESETS: HeadlineLayer['style']['preset'][] = [
  'stream_white_box',
  'export_bar',
  'stream_yellow',
  'export_bar_dark',
]

function patchLayer<T extends Layer>(layers: Layer[], id: string, patch: Partial<T>): Layer[] {
  return layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l))
}

type ActualVisualLayer = { key: string; label: string; kind: 'video' | 'broll' | 'text' | 'captions' | 'sticker' | 'badge' | 'headline' | 'hook'; id: string; startMs: number }

function ActualLayersList({ edits, layers, setLayers, onEdits, selectedKey, onSelect }: {
  edits: ClipEditsV2
  layers: Layer[]
  setLayers: (layers: Layer[]) => void
  onEdits: (next: ClipEditsV2) => void
  selectedKey?: string | null
  onSelect?: (kind: ActualVisualLayer['kind'], id: string, startMs: number) => void
}) {
  const [dragged, setDragged] = useState<string | null>(null)
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null)
  const broll = orderedStack(edits, 'broll', edits.broll ?? [])
  const text = orderedStack(edits, 'text', edits.textItems ?? [])
  // Visual stack from top to bottom (the video is the backmost visual layer).
  const stack: ActualVisualLayer[] = [
    ...layers.filter((l) => l.type === 'sticker').map((l) => ({ key: `sticker:${l.id}`, label: 'Sticker · ' + (('text' in l && l.text) || l.id), kind: 'sticker' as const, id: l.id, startMs: 0 })),
    ...text.slice().reverse().map((t) => ({ key: `text:${t.id}`, label: t.text?.trim().slice(0, 36) || 'Text', kind: 'text' as const, id: t.id, startMs: t.startMs })),
    { key: 'captions', label: 'Captions', kind: 'captions' as const, id: 'captions', startMs: 0 },
    ...layers.filter((l) => l.type === 'badge').map((l) => ({ key: `badge:${l.id}`, label: 'Platform badge', kind: 'badge' as const, id: l.id, startMs: 0 })),
    ...layers.filter((l) => l.type === 'headline').map((l) => ({ key: `headline:${l.id}`, label: 'Headline', kind: 'headline' as const, id: l.id, startMs: 0 })),
    ...(edits.hookOverlay ? [{ key: 'hook', label: 'Hook overlay', kind: 'hook' as const, id: 'hook', startMs: 0 }] : []),
    ...broll.slice().reverse().map((b) => ({ key: `broll:${b.id}`, label: `B-roll · ${b.id.slice(0, 18)}`, kind: 'broll' as const, id: b.id, startMs: b.startMs })),
    { key: 'video', label: 'Main video', kind: 'video', id: 'video', startMs: 0 },
  ]
  const off = new Set(edits.disabledItems ?? [])
  const disabled = (row: ActualVisualLayer) =>
    row.kind === 'captions' ? edits.captions?.enabled === false
      : row.kind === 'video' ? laneState(edits, 'video').hidden === true
      : row.kind === 'hook' ? edits.hookOverlay?.enabled === false
      : row.kind === 'sticker' || row.kind === 'badge' || row.kind === 'headline' ? !layers.find((l) => l.id === row.id)?.enabled
      : off.has(row.key)
  const toggleVisibility = (row: ActualVisualLayer) => {
    if (row.kind === 'video') return onEdits(setLaneState(edits, 'video', { hidden: !disabled(row) }))
    if (row.kind === 'captions') return onEdits({ ...edits, captions: { ...edits.captions, enabled: edits.captions?.enabled === false } })
    if (row.kind === 'sticker' || row.kind === 'badge' || row.kind === 'headline') return setLayers(layers.map((l) => l.id === row.id ? { ...l, enabled: !l.enabled } : l))
    if (row.kind === 'hook') return onEdits({ ...edits, hookOverlay: { ...edits.hookOverlay, enabled: !edits.hookOverlay?.enabled } })
    const next = toggleItemsEnabled(edits, [{ lane: row.kind, id: row.id }])
    if (next) onEdits(next)
  }
  const reorder = (src: ActualVisualLayer, to: ActualVisualLayer) => {
    // The shared preview/export model permits reordering overlapping items on
    // their same visual track, not arbitrary cross-type compositing.
    if (src.kind !== to.kind || (src.kind !== 'text' && src.kind !== 'broll') || src.key === to.key) return
    const rows = stack.filter((r) => r.kind === src.kind)
    const a = rows.findIndex((r) => r.key === src.key)
    const b = rows.findIndex((r) => r.key === to.key)
    if (a < 0 || b < 0) return
    let next = edits
    const dir = a < b ? 'backward' : 'forward'
    for (let i = 0; i < Math.abs(b - a); i++) next = moveInStack(next, src.key, dir)
    if (next !== edits) onEdits(next)
  }
  return (
    <section className="space-y-2 rounded-md border border-border p-2" data-testid="actual-layer-stack">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold">Layers · front to back</h3>
        <span className="text-[10px] text-muted-foreground">{stack.length} layers</span>
      </div>
      <ul className="space-y-1">
        {stack.map((row) => {
          const hidden = disabled(row)
          const track = row.kind === 'text' || row.kind === 'broll' || row.kind === 'video' ? row.kind : null
          const locked = track ? laneState(edits, track).locked === true : false
          return (
            <li key={row.key} className="flex items-center gap-1 rounded border border-border/60 px-1 py-1"
              data-testid={`actual-layer-${row.key}`}
              draggable={row.kind === 'text' || row.kind === 'broll'}
              onDragStart={(e) => { setDragged(row.key); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { if (dragged && dragged !== row.key) e.preventDefault() }}
              onDrop={(e) => { e.preventDefault(); const from = stack.find((r) => r.key === dragged); if (from) reorder(from, row); setDragged(null) }}
              onDragEnd={() => setDragged(null)}>
              <GripVertical size={13} className="shrink-0 text-muted-foreground" aria-hidden />
              <button type="button" className={`min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-xs ${(selectedKey === row.key || selectedRowKey === row.key) ? 'bg-primary/10 font-semibold' : ''}`}
                onClick={() => { setSelectedRowKey(row.key); onSelect?.(row.kind, row.id, row.startMs) }}
                data-testid={`actual-layer-select-${row.key}`}>{row.label}</button>
              <button type="button" className="rounded p-1 disabled:opacity-30"
                title={hidden ? 'Show layer' : 'Hide layer'}
                aria-label={`Toggle ${row.label} visibility`}
                onClick={() => toggleVisibility(row)}>
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              {track ? <button type="button" className="rounded p-1" title={locked ? 'Unlock track' : 'Lock track'}
                aria-label={`${locked ? 'Unlock' : 'Lock'} ${row.label} track`}
                onClick={() => onEdits(setLaneState(edits, track, { locked: !locked }))}>
                {locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button> : null}
            </li>
          )
        })}
      </ul>
      <p className="text-[10px] text-muted-foreground">Drag overlapping text or B-roll layers to change stacking within their track. Video and track locks prevent editing.</p>
    </section>
  )
}

export function LayersPanel({
  clipId,
  edits,
  layers,
  setLayers,
  onEdits,
  selectedLayerKey,
  onSelectActualLayer,
  platform,
  brandTemplates,
  onApplyTemplate,
  onApplyAutoTemplate,
  onSaveTemplate,
  onSyncEditsSaveVersion,
  savePending = false,
  clipType = null,
}: {
  clipId: string
  edits: ClipEditsV2
  layers: Layer[]
  setLayers: (layers: Layer[]) => void
  onEdits: (edits: ClipEditsV2) => void
  selectedLayerKey?: string | null
  onSelectActualLayer?: (kind: ActualVisualLayer['kind'], id: string, startMs: number) => void
  platform?: 'twitch' | 'kick'
  brandTemplates?: { id: string; name: string; settings: unknown; pending?: boolean }[]
  onApplyTemplate?: (templateId: string) => void
  onApplyAutoTemplate?: () => void
  onSaveTemplate?: (name: string) => void | Promise<void>
  onSyncEditsSaveVersion?: (version: number) => void
  savePending?: boolean
  clipType?: string | null
}) {
  const [templateName, setTemplateName] = useState('')
  const [safeZoneVisible, setSafeZoneVisible] = useSafeZoneVisible()
  const [radiusDraft, setRadiusDraft] = useState<number | null>(null)
  const [widthDraft, setWidthDraft] = useState<number | null>(null)
  const headline = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
  const badge = layers.find((l): l is BadgeLayer => l.id === 'badge' && l.type === 'badge')
  const sticker = layers.find((l): l is StickerLayer => l.type === 'sticker' && l.kind === 'follow_cta')

  const ensureBadge = (): BadgeLayer => {
    if (badge) return badge
    return {
      id: 'badge',
      type: 'badge',
      enabled: false,
      z: 71,
      platform: platform ?? 'twitch',
      showLabel: false,
      showLink: false,
      showLogo: false,
      placement: 'export_bar',
    }
  }

  const ensureSticker = (): StickerLayer => ({
    id: sticker?.id ?? 'follow_sticker',
    type: 'sticker',
    kind: 'follow_cta',
    enabled: sticker?.enabled ?? false,
    z: sticker?.z ?? 55,
    text: sticker?.text ?? 'FOLLOW',
    platform: sticker?.platform ?? platform ?? 'twitch',
    x: sticker?.x ?? 0.82,
    y: sticker?.y ?? 0.12,
    anchor: sticker?.anchor ?? 'TR',
    timing: sticker?.timing ?? 'always',
    durationMs: sticker?.durationMs ?? 4000,
  })

  const setHeadlineStyle = (preset: HeadlineLayer['style']['preset']) => {
    if (!headline) return
    const colors = headlineStyleForPreset(preset)
    setLayers(
      patchLayer(layers, 'headline', {
        style: { ...headline.style, preset, ...colors },
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {savePending ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Saving layers…
        </p>
      ) : null}
      <ActualLayersList edits={edits} layers={layers} setLayers={setLayers} onEdits={onEdits} selectedKey={selectedLayerKey} onSelect={onSelectActualLayer} />
      <details className="rounded-md border border-border/60 p-2" data-testid="layer-design-settings">
        <summary className="cursor-pointer text-xs text-muted-foreground">Legacy overlay design, branding and template settings</summary>
        <div className="mt-3 space-y-4">
      {(onApplyAutoTemplate || (brandTemplates && brandTemplates.length > 0 && onApplyTemplate)) ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium">Brand template</p>
          <div className="flex flex-wrap gap-2">
            {onApplyAutoTemplate ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onApplyAutoTemplate()}>
                Auto
              </Button>
            ) : null}
            {brandTemplates?.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(t.pending)}
                onClick={() => onApplyTemplate?.(t.id)}
              >
                {t.pending ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    {t.name}
                  </span>
                ) : (
                  t.name
                )}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Auto applies streamer defaults on VOD clips. Saved templates apply v3 layers when present.
          </p>
        </div>
      ) : null}

      {onSaveTemplate ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1 space-y-1">
            <Label htmlFor={`${clipId}-template-name`} className="text-xs">
              Template name
            </Label>
            <Input
              id={`${clipId}-template-name`}
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!templateName.trim()}
            onClick={() => {
              const name = templateName.trim()
              if (!name) return
              void Promise.resolve(onSaveTemplate(name)).then(() => setTemplateName(''))
            }}
          >
            Save template
          </Button>
        </div>
      ) : null}

      <EditorHeadlineField
        clipId={clipId}
        edits={edits}
        onEdits={onEdits}
        platform={platform}
        clipType={clipType}
        layers={layers}
        setLayers={setLayers}
        onSyncEditsSaveVersion={onSyncEditsSaveVersion}
      />

      {headline ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          {/* T6.3: with T6 titles the chips in EditorHeadlineField are the only title style;
              the legacy layer presets here (P7 hid only the copy inside the headline field)
              were a second, conflicting style row. */}
          {t6TitleAutoEnabled() ? null : (
            <>
              <Label className="text-xs font-medium">Headline style</Label>
              <div className="flex flex-wrap gap-2" data-testid="legacy-headline-style-row">
                {HEADLINE_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={headline.style.preset === preset ? 'default' : 'outline'}
                    onClick={() => setHeadlineStyle(preset)}
                  >
                    {preset.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </>
          )}
          <label className="block space-y-1 text-xs">
            Corner radius ({radiusDraft ?? headline.style.radiusPx ?? 0}px)
            <Slider
              min={0}
              max={48}
              step={2}
              value={[radiusDraft ?? headline.style.radiusPx ?? 0]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] : v
                setRadiusDraft(typeof n === 'number' ? n : 0)
              }}
              onValueCommitted={(v) => {
                const n = Array.isArray(v) ? v[0] : v
                setRadiusDraft(null)
                setLayers(
                  patchLayer(layers, 'headline', {
                    style: { ...headline.style, radiusPx: typeof n === 'number' ? n : 0 },
                  }),
                )
              }}
            />
          </label>
          <label className="block space-y-1 text-xs">
            Width ({widthDraft ?? headline.style.widthPct ?? 100}%)
            <Slider
              min={60}
              max={100}
              step={5}
              value={[widthDraft ?? headline.style.widthPct ?? 100]}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] : v
                setWidthDraft(typeof n === 'number' ? n : 100)
              }}
              onValueCommitted={(v) => {
                const n = Array.isArray(v) ? v[0] : v
                setWidthDraft(null)
                setLayers(
                  patchLayer(layers, 'headline', {
                    style: { ...headline.style, widthPct: typeof n === 'number' ? n : 100 },
                  }),
                )
              }}
            />
          </label>
          <label className="block space-y-1 text-xs">
            Font
            <Select
              value={headline.style.font ?? 'Anton'}
              onValueChange={(font) =>
                setLayers(
                  patchLayer(layers, 'headline', {
                    style: { ...headline.style, font },
                  }),
                )
              }
            >
              <SelectTrigger className="mt-1 h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Anton">Anton</SelectItem>
                <SelectItem value="Montserrat Black">Montserrat Black</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label className="text-xs">Show safe zone</Label>
        <Switch checked={safeZoneVisible} onCheckedChange={setSafeZoneVisible} />
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-xs font-medium">Platform badge & link</p>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Show platform label</Label>
          <Switch
            checked={Boolean(badge?.showLabel)}
            onCheckedChange={(on) => {
              const b = { ...ensureBadge(), showLabel: on, enabled: on || Boolean(badge?.showLink || badge?.showLogo) }
              const rest = layers.filter((l) => l.id !== 'badge')
              setLayers(on || badge ? [...rest, b] : rest)
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Show logo in badge</Label>
          <Switch
            checked={Boolean(badge?.showLogo)}
            onCheckedChange={(on) => {
              const b = { ...ensureBadge(), showLogo: on, enabled: true }
              const rest = layers.filter((l) => l.id !== 'badge')
              setLayers([...rest, b])
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Show channel link</Label>
          <Switch
            checked={Boolean(badge?.showLink)}
            onCheckedChange={(on) => {
              const b = { ...ensureBadge(), showLink: on, enabled: on || Boolean(badge?.showLabel || badge?.showLogo) }
              const rest = layers.filter((l) => l.id !== 'badge')
              setLayers(on || badge ? [...rest, b] : rest)
            }}
          />
        </div>
        <Input
          value={badge?.url ?? edits.exportTemplate?.channelLink?.url ?? ''}
          placeholder="https://twitch.tv/you"
          onChange={(e) => {
            const b = { ...ensureBadge(), url: e.target.value, enabled: true }
            const rest = layers.filter((l) => l.id !== 'badge')
            setLayers([...rest, b])
          }}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">Follow sticker</p>
          <Switch
            checked={Boolean(sticker?.enabled)}
            onCheckedChange={(on) => {
              const s = { ...ensureSticker(), enabled: on }
              const rest = layers.filter((l) => l.type !== 'sticker')
              setLayers(on ? [...rest, s] : rest)
            }}
          />
        </div>
        {sticker?.enabled !== false && (
          <>
            <Input
              value={sticker?.text ?? 'FOLLOW'}
              maxLength={32}
              onChange={(e) => {
                const s = { ...ensureSticker(), enabled: true, text: e.target.value }
                const rest = layers.filter((l) => l.type !== 'sticker')
                setLayers([...rest, s])
              }}
            />
            <label className="flex items-center gap-2 text-xs">
              Duration (ms)
              <Input
                type="number"
                className="h-8 w-24"
                value={sticker?.durationMs ?? 4000}
                onChange={(e) => {
                  const s = {
                    ...ensureSticker(),
                    enabled: true,
                    durationMs: Number(e.target.value) || 4000,
                  }
                  const rest = layers.filter((l) => l.type !== 'sticker')
                  setLayers([...rest, s])
                }}
              />
            </label>
          </>
        )}
      </div>
        </div>
      </details>
    </div>
  )
}
