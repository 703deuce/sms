'use client'

import { useEffect, useRef, useState } from 'react'
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
  normalizeChannelUrl,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import { clipsFetch } from '@/lib/clips-api'
import { ExportHeadlinePreview } from '@/components/clips/editor/export-headline-preview'
import { ExportSavedChannelsField } from '@/components/clips/editor/export-saved-channels-field'
import type { ClipUserStreamerChannelRow } from '@/lib/clips/clip-export-user-types'
import { toast } from 'sonner'

export function ExportTemplateSection({
  clipId,
  edits,
  layoutMode,
  platform,
  defaultChannelUrl,
  exportPlatformId,
  savedChannels = [],
  onChannelsRefresh,
  onChange,
}: {
  clipId: string
  edits: ClipEditsV2
  layoutMode: ClipEditsV2['layout']['mode']
  platform?: 'twitch' | 'kick'
  defaultChannelUrl?: string
  exportPlatformId?: ExportPlatformId
  savedChannels?: ClipUserStreamerChannelRow[]
  onChannelsRefresh?: () => void
  onChange: (tpl: ClipExportTemplate) => void
}) {
  const tpl = edits.exportTemplate || {}
  const headlineAllowed = headlineBarAllowedForLayout(layoutMode)
  const gens = tpl.headlineGenerations ?? 0
  const [genBusy, setGenBusy] = useState(false)
  const prefetchedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!headlineAllowed) return
    if (prefetchedFor.current === clipId) return
    const base = edits.exportTemplate || {}
    if (base.suggestedHeadline?.trim() || base.headlineBar?.text?.trim()) {
      prefetchedFor.current = clipId
      return
    }
    prefetchedFor.current = clipId
    void clipsFetch<{ exportTemplate: ClipExportTemplate }>(
      `/api/clips/clips/${clipId}/export-headline/prefetch`,
      { method: 'POST', body: '{}' },
    )
      .then((res) => {
        if (res.exportTemplate) {
          onChange({
            ...base,
            platform: platform ?? base.platform,
            ...res.exportTemplate,
          })
        }
      })
      .catch(() => {
        prefetchedFor.current = null
      })
  }, [clipId, headlineAllowed, edits.exportTemplate, onChange, platform])

  const setTpl = (patch: Partial<ClipExportTemplate>) => {
    onChange({ ...tpl, platform: platform ?? tpl.platform, ...patch })
  }

  const headlineEnabled = Boolean(tpl.headlineBar?.enabled)
  const headlineText =
    tpl.headlineBar?.text?.trim() ||
    tpl.suggestedHeadline?.trim() ||
    ''

  const generate = async () => {
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
      onChange({
        ...res.exportTemplate,
        headlineBar: {
          enabled: true,
          text: res.exportTemplate.headlineBar?.text || res.headline,
        },
        platform: platform ?? res.exportTemplate.platform ?? tpl.platform,
      })
      toast.success('New headline ready')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate headline')
    } finally {
      setGenBusy(false)
    }
  }

  const channelUrl = tpl.channelLink?.url || defaultChannelUrl || ''

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs font-medium">Stream headline template (export only)</p>
      <p className="text-xs text-muted-foreground">Preview clips stay clean; overlays apply when you export.</p>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">Headline bar</Label>
        <Switch
          checked={headlineEnabled && headlineAllowed}
          disabled={!headlineAllowed}
          onCheckedChange={(on) =>
            setTpl({ headlineBar: { enabled: on, text: headlineText || tpl.suggestedHeadline || '' } })
          }
        />
      </div>
      {!headlineAllowed ? (
        <p className="text-xs text-muted-foreground">
          Headline bar is only available on single-view layouts (not split, stack, or grid).
        </p>
      ) : (
        <>
          {headlineEnabled ? (
            <Input
              value={tpl.headlineBar?.text ?? tpl.suggestedHeadline ?? ''}
              maxLength={120}
              onChange={(e) => setTpl({ headlineBar: { enabled: true, text: e.target.value } })}
              onBlur={(e) =>
                setTpl({ headlineBar: { enabled: true, text: formatHeadlineForExport(e.target.value) } })
              }
              placeholder={tpl.suggestedHeadline?.trim() || 'ALL CAPS HEADLINE 🔥'}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Turn on the headline bar or use Generate to add a viral headline for export.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={genBusy} onClick={() => void generate()}>
              <Sparkles className="mr-1 size-3.5" />
              {genBusy ? 'Generating…' : 'Generate headline'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {gens}/{EXPORT_HEADLINE_MAX_REGENERATIONS} AI generations
            </span>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">Platform badge</Label>
        <Switch
          checked={Boolean(tpl.platformBadge?.enabled)}
          onCheckedChange={(on) => setTpl({ platformBadge: { enabled: on } })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">Channel link</Label>
        <Switch
          checked={Boolean(tpl.channelLink?.enabled)}
          onCheckedChange={(on) =>
            setTpl({
              channelLink: { enabled: on, url: normalizeChannelUrl(channelUrl) || channelUrl },
            })
          }
        />
      </div>
      {tpl.channelLink?.enabled ? (
        <>
          <Input
            value={channelUrl}
            onChange={(e) => {
              const norm = normalizeChannelUrl(e.target.value)
              setTpl({ channelLink: { enabled: true, url: norm || e.target.value } })
            }}
            placeholder="https://twitch.tv/yourchannel"
          />
          <ExportSavedChannelsField
            platform={platform ?? tpl.platform}
            channelUrl={channelUrl}
            savedChannels={savedChannels}
            onSelectUrl={(url) => setTpl({ channelLink: { enabled: true, url } })}
            onChannelsChange={() => onChannelsRefresh?.()}
          />
        </>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">Profanity bleep</Label>
        <Switch
          checked={Boolean(tpl.profanityCensor)}
          onCheckedChange={(on) => setTpl({ profanityCensor: on })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Bleeps curse words using transcript timing and masks captions (off by default).
      </p>

      <ExportHeadlinePreview
        headline={headlineEnabled && headlineAllowed ? effectiveHeadlineText({ ...tpl, headlineBar: { enabled: true, text: headlineText } }) : ''}
        showBadge={Boolean(tpl.platformBadge?.enabled)}
        platform={platform ?? tpl.platform}
        channelUrl={tpl.channelLink?.enabled ? normalizeChannelUrl(channelUrl) || undefined : undefined}
        exportPlatformId={exportPlatformId ?? tpl.exportPlatformId ?? 'tiktok'}
      />
    </div>
  )
}
