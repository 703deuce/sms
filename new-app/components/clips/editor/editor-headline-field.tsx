'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  EXPORT_HEADLINE_MAX_REGENERATIONS,
  effectiveHeadlineText,
  formatHeadlineForExport,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { headlinePlacementNote } from '@/lib/clips/headline-band-layout'
import { patchEditorExportTemplateHeadline } from '@/lib/clips/editor-export-template-seed'
import { clipsFetch } from '@/lib/clips-api'
import { ExportHeadlinePreview } from '@/components/clips/editor/export-headline-preview'
import type { HeadlineLayer, Layer } from '@/lib/clips/layers'
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'
import { t6TitleAutoEnabled } from '@/lib/clips/t6-feature-flags'
import { TITLE_STYLES } from '@/lib/clips/templates/registry'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useState } from 'react'

export const T6_TITLE_PLACEMENT_NOTE = 'Shown as the title above the video. Pick its style below.'

export function EditorHeadlineField({
  clipId,
  edits,
  onEdits,
  platform,
  clipType = null,
  layers,
  setLayers,
  onSyncEditsSaveVersion,
  previewOnly = false,
}: {
  clipId: string
  edits: ClipEditsV2
  onEdits: (edits: ClipEditsV2) => void
  platform?: 'twitch' | 'kick'
  clipType?: string | null
  layers?: Layer[]
  setLayers?: (layers: Layer[]) => void
  onSyncEditsSaveVersion?: (version: number) => void
  /** Template-mode guard: keep headline edits local and disable server-side AI generation. */
  previewOnly?: boolean
}) {
  const tpl = edits.exportTemplate ?? {}
  const layoutMode = edits.layout.mode
  const enabled = Boolean(tpl.headlineBar?.enabled)
  const displayText = tpl.headlineBar?.text?.trim() || tpl.suggestedHeadline?.trim() || ''
  const gens = tpl.headlineGenerations ?? 0
  const [genBusy, setGenBusy] = useState(false)

  const generate = async () => {
    if (previewOnly) {
      toast.message('AI headline generation is unavailable while previewing a reusable style')
      return
    }
    if (gens >= EXPORT_HEADLINE_MAX_REGENERATIONS) {
      toast.error(`Max ${EXPORT_HEADLINE_MAX_REGENERATIONS} AI headlines per clip`)
      return
    }
    setGenBusy(true)
    const toastId = toast.loading('Generating headline…')
    try {
      const res = await clipsFetch<{
        headline: string
        generations: number
        exportTemplate: ClipExportTemplate
        editsSaveVersion?: number
      }>(`/api/clips/clips/${clipId}/export-headline/generate`, { method: 'POST', body: '{}' })
      onEdits({
        ...edits,
        exportTemplate: {
          ...res.exportTemplate,
          headlineBar: {
            enabled: true,
            text: res.exportTemplate.headlineBar?.text || res.headline,
          },
        },
      })
      if (typeof res.editsSaveVersion === 'number') onSyncEditsSaveVersion?.(res.editsSaveVersion)
      toast.success('Headline updated', { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate headline', { id: toastId })
    } finally {
      setGenBusy(false)
    }
  }

  const applyHeadlineLayerStyle = (preset: HeadlineLayer['style']['preset']) => {
    if (!layers || !setLayers) return
    const hl = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
    if (!hl) return
    const colors = headlineStyleForPreset(preset)
    setLayers(
      layers.map((l) =>
        l.id === 'headline' && l.type === 'headline'
          ? { ...hl, style: { ...hl.style, preset, ...colors } }
          : l,
      ),
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-xs font-medium">Headline</p>
        <p className="text-xs text-muted-foreground" data-testid="headline-placement-note">
          {/* T6.4: with T6 titles the headline is burned as the title above the video, not the
              legacy export bar. */}
          {t6TitleAutoEnabled() ? T6_TITLE_PLACEMENT_NOTE : headlinePlacementNote(layoutMode)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">Show headline</Label>
        <Switch
          checked={enabled}
          aria-label="Show headline"
          onCheckedChange={(on) =>
            onEdits(
              patchEditorExportTemplateHeadline(
                edits,
                {
                  enabled: on,
                  text: displayText || tpl.suggestedHeadline || '',
                },
                { clipType },
              ),
            )
          }
        />
      </div>
      <Input
        className={cn(genBusy && 'animate-pulse opacity-70')}
        value={tpl.headlineBar?.text ?? tpl.suggestedHeadline ?? ''}
        maxLength={120}
        disabled={!enabled || genBusy}
        onChange={(e) =>
          onEdits(
            patchEditorExportTemplateHeadline(
              edits,
              {
                enabled: true,
                text: e.target.value,
              },
              { clipType },
            ),
          )
        }
        onBlur={(e) =>
          onEdits(
            patchEditorExportTemplateHeadline(
              edits,
              {
                enabled: enabled || Boolean(e.target.value.trim()),
                text: formatHeadlineForExport(e.target.value),
              },
              { clipType },
            ),
          )
        }
        placeholder={tpl.suggestedHeadline?.trim() || 'ALL CAPS HEADLINE 🔥'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={displayText ? 'outline' : 'default'}
          disabled={previewOnly || genBusy || gens >= EXPORT_HEADLINE_MAX_REGENERATIONS}
          title={previewOnly ? 'AI generation is disabled in preview-only template customization' : undefined}
          onClick={() => void generate()}
        >
          {genBusy ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden /> : <Sparkles className="mr-1 size-3.5" />}
          {genBusy ? 'Generating…' : 'Generate headline'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {previewOnly
            ? 'AI generation stays disabled until the style is applied'
            : `${gens}/${EXPORT_HEADLINE_MAX_REGENERATIONS} AI generations`}
        </span>
      </div>
      {t6TitleAutoEnabled() ? (
        <div className="flex flex-wrap gap-2">
          {Object.keys(TITLE_STYLES).map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={tpl.headlineStyle?.t6Id === id ? 'default' : 'outline'}
              onClick={() =>
                onEdits({
                  ...edits,
                  exportTemplate: {
                    ...tpl,
                    headlineStyle: { ...(tpl.headlineStyle ?? {}), t6Id: id },
                  },
                })
              }
            >
              {id.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      ) : null}
      {setLayers && layers && !t6TitleAutoEnabled() ? (
        <div className="flex flex-wrap gap-2">
          {(['stream_white_box', 'export_bar'] as const).map((preset) => (
            <Button key={preset} type="button" size="sm" variant="outline" onClick={() => applyHeadlineLayerStyle(preset)}>
              {preset === 'stream_white_box' ? 'White box' : 'Export bar'}
            </Button>
          ))}
        </div>
      ) : null}
      <ExportHeadlinePreview
        headline={enabled ? effectiveHeadlineText(tpl) : ''}
        showBadge={false}
        platform={platform ?? tpl.platform}
        exportPlatformId={tpl.exportPlatformId ?? 'tiktok'}
      />
    </div>
  )
}
