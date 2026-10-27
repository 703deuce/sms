'use client'

import { useCallback, useEffect, useState } from 'react'
import { Code, Copy, Download, Eye, Link2, Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

type PublicPayload = {
  title: string
  playbackUrl: string | null
  playbackStatus: 'ready' | 'processing' | 'unavailable'
  showTranscript: boolean
  allowComments: boolean
  allowDownload: boolean
  transcriptText: string
  viewCount?: number
  mode: 'view' | 'comment'
}

export function ShareClipViewer({
  title,
  publicPath,
  initialViewCount,
}: {
  title: string
  publicPath: string
  initialViewCount?: number
}) {
  const [data, setData] = useState<PublicPayload | null>(null)
  const [embedOpen, setEmbedOpen] = useState(false)
  const [startAt, setStartAt] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(publicPath)
    const json = (await res.json()) as { data?: PublicPayload }
    if (json.data) setData(json.data)
  }, [publicPath])

  useEffect(() => {
    void load()
    const t = setInterval(() => {
      if (data?.playbackStatus === 'processing') void load()
    }, 4000)
    return () => clearInterval(t)
  }, [load, data?.playbackStatus])

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const embedCode = `<iframe src="${pageUrl}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`

  const copy = (text: string, msg: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(msg)
  }

  const processing = data?.playbackStatus === 'processing' || (!data?.playbackUrl && data?.playbackStatus !== 'unavailable')

  return (
    <div className="min-h-dvh bg-background" data-testid="share-clip-viewer">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-8">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Transovo</span>
          <span className="text-sm text-muted-foreground">{data?.title ?? title}</span>
        </div>
        <div className="flex items-center gap-2">
          {(data?.viewCount ?? initialViewCount) != null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="share-view-count">
              <Eye className="size-4" />
              {(data?.viewCount ?? initialViewCount ?? 0).toLocaleString()} views
            </span>
          )}
          {data?.allowDownload && data.playbackUrl && (
            <Button type="button" size="icon-sm" variant="ghost" render={<a href={data.playbackUrl} download />} title="Download">
              <Download className="size-4" />
            </Button>
          )}
          <Button type="button" size="icon-sm" variant="ghost" title="Copy link" onClick={() => copy(pageUrl, 'Link copied')}>
            <Link2 className="size-4" />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" title="Embed" onClick={() => setEmbedOpen((o) => !o)}>
            <Code className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" size="icon-sm" variant="ghost" title="View options">
                  <Settings className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 p-3">
              <div className="flex h-9 items-center justify-between">
                <Label className="text-xs">Show transcript</Label>
                <Switch checked={data?.showTranscript !== false} disabled />
              </div>
              <div className="flex h-9 items-center justify-between">
                <Label className="text-xs">Allow comments</Label>
                <Switch checked={data?.allowComments === true} disabled />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Change access in the editor</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {embedOpen && (
        <div className="border-b border-border bg-muted/40 px-4 py-3 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="start-at" checked={startAt} onChange={(e) => setStartAt(e.target.checked)} />
              <label htmlFor="start-at" className="text-xs">Start at 00:00</label>
            </div>
            <div className="flex gap-2">
              <code className="flex-1 rounded-lg bg-muted p-2 text-[11px]">{embedCode}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => copy(embedCode, 'Embed code copied')}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 p-4 max-[1100px]:grid-cols-1 md:grid-cols-[1fr_360px] md:p-8">
        <div className="aspect-video overflow-hidden rounded-xl bg-black" data-testid="share-playback">
          {data?.playbackUrl ? (
            <video src={data.playbackUrl} controls className="h-full w-full" playsInline />
          ) : processing ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-white/80" />
              <span className="text-white/90">Preparing your video…</span>
              <span className="text-xs text-white/60">Rendered export in progress</span>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading player…</div>
          )}
        </div>
        {data?.showTranscript !== false && (
          <aside className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Transcript</h2>
            <p className="mt-3 max-h-[60vh] overflow-y-auto text-[15px] leading-relaxed text-muted-foreground">
              {data?.transcriptText || 'Transcript will appear when processing completes.'}
            </p>
            {data?.mode === 'comment' && (
              <p className="mt-4 text-xs text-muted-foreground">Sign in to add comments on this review link.</p>
            )}
          </aside>
        )}
      </main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Made with Transovo
      </footer>
    </div>
  )
}
