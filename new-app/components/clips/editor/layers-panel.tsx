'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { HeadlineLayer, BadgeLayer, Layer, StickerLayer } from '@/lib/clips/layers'
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'
import { templateFromEdits } from '@/lib/clips/layers-template'
import { EditorHeadlineField } from '@/components/clips/editor/editor-headline-field'

const HEADLINE_PRESETS: HeadlineLayer['style']['preset'][] = [
  'stream_white_box',
  'export_bar',
  'stream_yellow',
  'export_bar_dark',
]

function patchLayer<T extends Layer>(layers: Layer[], id: string, patch: Partial<T>): Layer[] {
  return layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l))
}

export function LayersPanel({
  clipId,
  edits,
  layers,
  setLayers,
  onEdits,
  platform,
  brandTemplates,
  onApplyTemplate,
  onSaveTemplate,
  onSyncEditsSaveVersion,
}: {
  clipId: string
  edits: ClipEditsV2
  layers: Layer[]
  setLayers: (layers: Layer[]) => void
  onEdits: (edits: ClipEditsV2) => void
  platform?: 'twitch' | 'kick'
  brandTemplates?: { id: string; name: string; settings: unknown }[]
  onApplyTemplate?: (templateId: string) => void
  onSaveTemplate?: () => void | Promise<void>
  onSyncEditsSaveVersion?: (version: number) => void
}) {
  const headline = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
  const badge = layers.find((l): l is BadgeLayer => l.id === 'badge' && l.type === 'badge')
  const sticker = layers.find((l): l is StickerLayer => l.type === 'sticker' && l.kind === 'follow_cta')

  const saveTemplateSnapshot = useMemo(() => templateFromEdits(edits, 'Current clip'), [edits])

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
      {brandTemplates && brandTemplates.length > 0 && onApplyTemplate ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium">Brand template</p>
          <div className="flex flex-wrap gap-2">
            {brandTemplates.map((t) => (
              <Button key={t.id} type="button" size="sm" variant="outline" onClick={() => onApplyTemplate(t.id)}>
                {t.name}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Applies v3 layers when the template includes templateV3; otherwise legacy brand fields.
          </p>
        </div>
      ) : null}

      {onSaveTemplate ? (
        <Button type="button" size="sm" variant="outline" onClick={() => void onSaveTemplate()}>
          Save as brand template
        </Button>
      ) : null}

      <EditorHeadlineField
        clipId={clipId}
        edits={edits}
        onEdits={onEdits}
        platform={platform}
        layers={layers}
        setLayers={setLayers}
        onSyncEditsSaveVersion={onSyncEditsSaveVersion}
      />

      {headline ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label className="text-xs font-medium">Headline style</Label>
          <div className="flex flex-wrap gap-2">
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
        </div>
      ) : null}

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

      <details className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Template v3 snapshot</summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(saveTemplateSnapshot, null, 2)}
        </pre>
      </details>
    </div>
  )
}
