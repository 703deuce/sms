'use client'

import { useState } from 'react'
import { Copy, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  EXPORT_PLATFORM_IDS,
  exportPlatformLabel,
  type ExportPlatformId,
} from '@/lib/clips/export-platform-presets'
import { clipsFetch } from '@/lib/clips-api'

type PlatformPostCopy = { title: string; description: string; hashtags: string[] }

type PostCopyMeta = {
  hookText?: string
  platforms?: Record<string, PlatformPostCopy>
  generatedAt?: string
  costUsdMicros?: number
}

function formatPost(p: PlatformPostCopy): string {
  const tags = p.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  return [p.title, '', p.description, '', tags].filter((line, i, arr) => line !== '' || i < arr.length - 1).join('\n').trim()
}

export function ClipPostCopy({ clipId, aiMeta }: { clipId: string; aiMeta?: unknown }) {
  const stored = (aiMeta && typeof aiMeta === 'object' ? (aiMeta as { postCopy?: PostCopyMeta }).postCopy : undefined) as
    | PostCopyMeta
    | undefined
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<PostCopyMeta | undefined>(stored)

  const generate = async () => {
    setBusy(true)
    try {
      const res = await clipsFetch<{
        hookText: string
        platforms: Record<ExportPlatformId, PlatformPostCopy>
        costUsdMicros: number
      }>(`/api/clips/clips/${clipId}/post-copy`, { method: 'POST', body: '{}' })
      setLocal({
        hookText: res.hookText,
        platforms: res.platforms,
        costUsdMicros: res.costUsdMicros,
        generatedAt: new Date().toISOString(),
      })
      toast.success('Post copy ready')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate post copy')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Copy failed')
    }
  }

  if (!local?.platforms) {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void generate()}>
        <Sparkles className="mr-1 size-3.5" aria-hidden />
        {busy ? 'Writing copy…' : 'Generate post copy'}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Post-ready copy</p>
        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => void generate()}>
          Regenerate
        </Button>
      </div>
      {local.hookText ? (
        <div className="flex items-start justify-between gap-2 text-xs">
          <p className="line-clamp-2 text-foreground">
            <span className="font-medium">Hook: </span>
            {local.hookText}
          </p>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Copy hook text"
            onClick={() => void copy(local.hookText!, 'Hook')}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
      ) : null}
      {EXPORT_PLATFORM_IDS.map((id) => {
        const p = local.platforms?.[id]
        if (!p) return null
        const body = formatPost(p)
        return (
          <div key={id} className="rounded border border-border/60 bg-background p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium text-primary">{exportPlatformLabel(id)}</p>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Copy ${exportPlatformLabel(id)} post`}
                onClick={() => void copy(body, exportPlatformLabel(id))}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-medium">{p.title}</p>
            <p className="line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>
          </div>
        )
      })}
    </div>
  )
}
