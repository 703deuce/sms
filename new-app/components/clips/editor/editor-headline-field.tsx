'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  EXPORT_HEADLINE_MAX_REGENERATIONS,
  effectiveHeadlineText,
  formatHeadlineForExport,
  headlineBarAllowedForLayout,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { patchEditorExportTemplateHeadline } from '@/lib/clips/editor-export-template-seed'
import { clipsFetch } from '@/lib/clips-api'
import { ExportHeadlinePreview } from '@/components/clips/editor/export-headline-preview'
import { toast } from 'sonner'
import { useState } from 'react'

export function EditorHeadlineField({
  clipId,
  edits,
  onEdits,
  platform,
}: {
  clipId: string
  edits: ClipEditsV2
  onEdits: (edits: ClipEditsV2) => void
  platform?: 'twitch' | 'kick'
}) {
  const tpl = edits.exportTemplate ?? {}
  const layoutMode = edits.layout.mode
  const allowed = headlineBarAllowedForLayout(layoutMode)
  const enabled = Boolean(tpl.headlineBar?.enabled)
  const displayText = tpl.headlineBar?.text?.trim() || tpl.suggestedHeadline?.trim() || ''
  const gens = tpl.headlineGenerations ?? 0
  const [genBusy, setGenBusy] = useState(false)

  const setTemplate = (next: ClipExportTemplate) => {
    onEdits({ ...edits, exportTemplate: next })
  }

  const generate = async () => {
    if (!allowed) return
    if (gens >= EXPORT_HEADLINE_MAX_REGENERATIONS) {
      toast.error(`Max ${EXPORT_HEADLINE_MAX_REGENERATIONS} AI headlines per clip`)
      return
    }
    setGenBusy(true)
    try {
      const res = await clipsFetch<{
        headline: string
        generations: number
        exportTemplate: ClipExportTemplate
      }>(`/api/clips/clips/${clipId}/export-headline/generate`, { method: 'POST', body: '{}' })
      setTemplate({
        ...res.exportTemplate,
        headlineBar: {
          enabled: true,
          text: res.exportTemplate.headlineBar?.text || res.headline,
        },
      })
      toast.success('Headline updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate headline')
    } finally {
      setGenBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-xs font-medium">Headline</p>
        <p className="text-xs text-muted-foreground">
          Shown on Headline + video and Full frame layouts; saved with your clip and used on export.
        </p>
      </div>
      {!allowed ? (
        <p className="text-xs text-muted-foreground">
          Switch to Headline + video or Full frame to show a headline band.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Show headline</Label>
            <Switch
              checked={enabled}
              aria-label="Show headline"
              onCheckedChange={(on) =>
                onEdits(
                  patchEditorExportTemplateHeadline(edits, {
                    enabled: on,
                    text: displayText || tpl.suggestedHeadline || '',
                  }),
                )
              }
            />
          </div>
          <Input
            value={tpl.headlineBar?.text ?? tpl.suggestedHeadline ?? ''}
            maxLength={120}
            disabled={!enabled}
            onChange={(e) =>
              onEdits(
                patchEditorExportTemplateHeadline(edits, {
                  enabled: true,
                  text: e.target.value,
                }),
              )
            }
            onBlur={(e) =>
              onEdits(
                patchEditorExportTemplateHeadline(edits, {
                  enabled: enabled || Boolean(e.target.value.trim()),
                  text: formatHeadlineForExport(e.target.value),
                }),
              )
            }
            placeholder={tpl.suggestedHeadline?.trim() || 'ALL CAPS HEADLINE 🔥'}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={displayText ? 'outline' : 'default'}
              disabled={genBusy || gens >= EXPORT_HEADLINE_MAX_REGENERATIONS}
              onClick={() => void generate()}
            >
              <Sparkles className="mr-1 size-3.5" />
              {genBusy ? 'Generating…' : 'Generate headline'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {gens}/{EXPORT_HEADLINE_MAX_REGENERATIONS} AI generations
            </span>
          </div>
          <ExportHeadlinePreview
            headline={enabled ? effectiveHeadlineText(tpl) : ''}
            showBadge={false}
            platform={platform ?? tpl.platform}
            exportPlatformId={tpl.exportPlatformId ?? 'tiktok'}
          />
        </>
      )}
    </div>
  )
}
