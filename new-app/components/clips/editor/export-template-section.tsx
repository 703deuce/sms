'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { clipsFetch, patchClip } from '@/lib/clips-api'
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
  onPatchEdits,
  chatAvailable = true,
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
  onPatchEdits?: (patch: Partial<ClipEditsV2>) => void
  /** False when VOD has no chat log — toggle disabled with note. */
  chatAvailable?: boolean
}) {
  const tpl = edits.exportTemplate || {}
  const headlineAllowed = headlineBarAllowedForLayout(layoutMode)
  const gens = tpl.headlineGenerations ?? 0
  const [genBusy, setGenBusy] = useState(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const withPlatform = useCallback(
    (next: ClipExportTemplate): ClipExportTemplate => ({
      ...next,
      platform: platform ?? next.platform ?? tpl.platform,
    }),
    [platform, tpl.platform],
  )

  const commitTemplate = useCallback(
    (next: ClipExportTemplate, opts?: { persist?: boolean }) => {
      const merged = withPlatform(next)
      onChange(merged)
      if (!opts?.persist) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void patchClip(clipId, { edits: { exportTemplate: merged } }).catch(() => {
          toast.error('Could not save export template')
        })
      }, 350)
    },
    [clipId, onChange, withPlatform],
  )

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [])

  const setTpl = (patch: Partial<ClipExportTemplate>, persist = true) => {
    commitTemplate({ ...tpl, ...patch }, { persist })
  }

  const headlineEnabled = Boolean(tpl.headlineBar?.enabled)
  const headlineText =
    tpl.headlineBar?.text?.trim() ||
    tpl.suggestedHeadline?.trim() ||
    ''

  const generate = async () => {
    if (!headlineAllowed) return
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
      const next = withPlatform({
        ...res.exportTemplate,
        headlineBar: {
          enabled: true,
          text: res.exportTemplate.headlineBar?.text || res.headline,
        },
      })
      onChange(next)
      await patchClip(clipId, { edits: { exportTemplate: next } })
      toast.success('Headline saved for export')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate headline')
    } finally {
      setGenBusy(false)
    }
  }

  const channelUrl = tpl.channelLink?.url || defaultChannelUrl || ''
  const badgeOn = Boolean(tpl.platformBadge?.enabled)
  const linkOn = Boolean(tpl.channelLink?.enabled)

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs font-medium">Stream headline template</p>
      <p className="text-xs text-muted-foreground">
        fit_top layout: white headline band, full-width video, blur footer. Toggle headline off for fit_blur.
      </p>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">Headline bar</Label>
        <Switch
          checked={headlineEnabled && headlineAllowed}
          disabled={!headlineAllowed}
          onCheckedChange={(on) => {
            setTpl({ headlineBar: { enabled: on, text: headlineText || tpl.suggestedHeadline || '' } })
            onPatchEdits?.({
              layout: { mode: on ? 'fit_top' : 'fit_blur', shotOverrides: edits.layout?.shotOverrides ?? [] },
            })
          }}
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
              onChange={(e) => setTpl({ headlineBar: { enabled: true, text: e.target.value } }, false)}
              onBlur={(e) =>
                setTpl({ headlineBar: { enabled: true, text: formatHeadlineForExport(e.target.value) } })
              }
              placeholder={tpl.suggestedHeadline?.trim() || 'ALL CAPS HEADLINE 🔥'}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Turn on the headline bar or generate a viral headline below.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={headlineText ? 'outline' : 'default'}
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
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm">Platform badge</Label>
          <p className="text-xs text-muted-foreground">Kick / Twitch pill on the video (export only).</p>
        </div>
        <Switch
          checked={badgeOn}
          onCheckedChange={(on) => setTpl({ platformBadge: { enabled: on } })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm">Channel link</Label>
          <p className="text-xs text-muted-foreground">Channel URL beside the badge on export.</p>
        </div>
        <Switch
          checked={linkOn}
          onCheckedChange={(on) => {
            const url = normalizeChannelUrl(channelUrl) || channelUrl
            setTpl({
              channelLink: { enabled: on, url: on ? url || defaultChannelUrl || '' : url },
            })
          }}
        />
      </div>
      {linkOn ? (
        <>
          <Input
            value={channelUrl}
            onChange={(e) => {
              const norm = normalizeChannelUrl(e.target.value)
              setTpl({ channelLink: { enabled: true, url: norm || e.target.value } }, false)
            }}
            onBlur={(e) => {
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
        <div>
          <Label className="text-sm">Show chat</Label>
          <p className="text-xs text-muted-foreground">
            Burn VOD chat into the lower blur band (export continues if chat is missing).
          </p>
        </div>
        <Switch
          checked={Boolean(edits.chatOverlay?.enabled)}
          disabled={!chatAvailable}
          onCheckedChange={(on) =>
            onPatchEdits?.({
              chatOverlay: {
                ...edits.chatOverlay,
                enabled: on,
                position: edits.chatOverlay?.position ?? 'bottom',
                opacity: edits.chatOverlay?.opacity ?? 0.6,
              },
            })
          }
        />
      </div>
      {!chatAvailable ? (
        <p className="text-xs text-muted-foreground">No chat log for this VOD — chat overlay unavailable.</p>
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
        showBadge={badgeOn}
        platform={platform ?? tpl.platform}
        channelUrl={linkOn ? normalizeChannelUrl(channelUrl) || undefined : undefined}
        exportPlatformId={exportPlatformId ?? tpl.exportPlatformId ?? 'tiktok'}
      />
    </div>
  )
}
