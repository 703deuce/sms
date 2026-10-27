'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  Code,
  Copy,
  Download,
  Eye,
  ExternalLink,
  Link2,
  Loader2,
  LogIn,
  MessageSquare,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatRelativeTime } from '@/lib/format-relative-time'
import type { ViewEventDto } from '@/lib/server/clips/composition-share-public'

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
  signInRequired?: boolean
  brandName?: string
  brandLogoUrl?: string | null
  brandAccentColor?: string | null
  authorName?: string | null
  publishedAt?: string | null
  viewEvents?: ViewEventDto[]
  requireSignInToView?: boolean
  requireSignInToEmbed?: boolean
}

export function ShareClipViewer({
  title,
  publicPath,
  initialViewCount,
  editHref,
}: {
  title: string
  publicPath: string
  initialViewCount?: number
  editHref?: string
}) {
  const [data, setData] = useState<PublicPayload | null>(null)
  const [embedOpen, setEmbedOpen] = useState(false)
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [startAt, setStartAt] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(publicPath, { credentials: 'include' })
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

  const pageUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''
  const embedUrl = `${pageUrl}${pageUrl.includes('?') ? '&' : '?'}embed=1`
  const embedCode = `<iframe src="${embedUrl}" width="640" height="360" frameborder="0" allowfullscreen title="${data?.title ?? title}"></iframe>`

  const copy = (text: string, msg: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(msg)
  }

  const processing = data?.playbackStatus === 'processing' || (!data?.playbackUrl && data?.playbackStatus !== 'unavailable' && !data?.signInRequired)
  const accent = data?.brandAccentColor ?? undefined
  const viewCount = data?.viewCount ?? initialViewCount ?? 0

  if (data?.signInRequired) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6" data-testid="share-sign-in-required">
        <div className="w-full max-w-[400px] rounded-xl border border-border bg-card p-8 text-center">
          <LogIn className="mx-auto mb-4 size-8 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">Sign in to view this video</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.title || title} requires a Transovo account.
          </p>
          <Button type="button" className="mt-6 w-full" render={<Link href="/app/clips" />}>
            Sign in
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background" data-testid="share-clip-viewer" style={accent ? { ['--brand-accent' as string]: accent } : undefined}>
      <header
        className="flex h-14 items-center justify-between border-b border-border px-4 md:px-8"
        style={accent ? { borderBottomColor: `${accent}33` } : undefined}
      >
        <div className="flex min-w-0 items-center gap-3">
          {data?.brandLogoUrl ? (
            <img src={data.brandLogoUrl} alt="" className="size-8 rounded-md object-contain" />
          ) : (
            <span
              className="flex size-8 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ backgroundColor: accent ?? 'var(--primary)' }}
            >
              {(data?.brandName ?? 'T').slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data?.brandName ?? 'Transovo'}</p>
            <p className="truncate text-xs text-muted-foreground">{data?.title ?? title}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Popover open={viewsOpen} onOpenChange={setViewsOpen}>
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant="ghost" className="gap-1 text-xs" data-testid="share-view-count">
                  <Eye className="size-4" />
                  {viewCount.toLocaleString()} views
                </Button>
              }
            />
            <PopoverContent align="end" className="w-72 p-3">
              <p className="text-sm font-semibold">Page views</p>
              <p className="text-xs text-muted-foreground">{viewCount.toLocaleString()} total views</p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
                {(data?.viewEvents ?? []).length === 0 && (
                  <li className="text-muted-foreground">Viewer details appear when viewers are signed in.</li>
                )}
                {(data?.viewEvents ?? []).map((ev) => (
                  <li key={ev.at} className="flex justify-between gap-2">
                    <span className="truncate font-medium">{ev.label ?? 'Viewer'}</span>
                    <span className="shrink-0 text-muted-foreground">{formatRelativeTime(ev.at)}</span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          {data?.allowComments && (
            <Button type="button" size="icon-sm" variant="ghost" title="Comments" aria-label="Comments">
              <MessageSquare className="size-4" />
            </Button>
          )}
          {data?.allowDownload && data.playbackUrl && (
            <Button type="button" size="icon-sm" variant="ghost" render={<a href={data.playbackUrl} download />} title="Download">
              <Download className="size-4" />
            </Button>
          )}
          <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
            <PopoverTrigger
              render={
                <Button type="button" size="icon-sm" variant="ghost" title="Copy link and embed">
                  <Link2 className="size-4" />
                </Button>
              }
            />
            <PopoverContent align="end" className="w-[420px] space-y-3 p-4">
              <div className="flex gap-2">
                <code className="flex-1 truncate rounded-lg bg-muted px-2 py-2 text-[11px]">{pageUrl}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(pageUrl, 'Link copied')}>
                  Copy link
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={startAt} onChange={(e) => setStartAt(e.target.checked)} />
                Start at 00:00
              </label>
              <div className="flex gap-2">
                <code className="max-h-24 flex-1 overflow-auto rounded-lg bg-muted p-2 text-[11px]">{embedCode}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(embedCode, 'Embed code copied')}>
                  <Code className="size-4" />
                </Button>
              </div>
              {data?.requireSignInToEmbed && (
                <p className="text-[11px] text-muted-foreground">Embed requires viewers to sign in.</p>
              )}
            </PopoverContent>
          </Popover>
          <Button type="button" size="icon-sm" variant="ghost" title="Embed panel" onClick={() => setEmbedOpen((o) => !o)}>
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
                <Label className="text-xs">Allow downloads</Label>
                <Switch checked={data?.allowDownload === true} disabled />
              </div>
              <div className="flex h-9 items-center justify-between">
                <Label className="text-xs">Show transcript</Label>
                <Switch checked={data?.showTranscript !== false} disabled />
              </div>
              <div className="flex h-9 items-center justify-between">
                <Label className="text-xs">Allow comments</Label>
                <Switch checked={data?.allowComments === true} disabled />
              </div>
              <div className="flex h-9 items-center justify-between">
                <Label className="text-xs">Require sign-in to view</Label>
                <Switch checked={data?.requireSignInToView === true} disabled />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Change access in the editor</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {editHref && (
            <Button type="button" size="sm" variant="outline" render={<Link href={editHref} />}>
              Edit
            </Button>
          )}
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
        <div>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">{data?.title ?? title}</h1>
          {(data?.authorName || data?.publishedAt) && (
            <p className="mb-4 text-sm text-muted-foreground">
              {data.authorName ? `by ${data.authorName}` : ''}
              {data.publishedAt ? ` · ${new Date(data.publishedAt).toLocaleDateString()}` : ''}
            </p>
          )}
          <div className="aspect-video overflow-hidden rounded-xl bg-black" data-testid="share-playback">
            {data?.playbackUrl ? (
              <video src={data.playbackUrl} controls className="h-full w-full" playsInline />
            ) : processing ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-white/80" />
                <span className="text-white/90">Processing video…</span>
                <span className="text-xs text-white/60">Rendered export in progress</span>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading player…</div>
            )}
          </div>
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
        Made with{' '}
        <Link href="/" className="underline hover:text-foreground">
          Transovo
        </Link>
        {data?.brandName && data.brandName !== 'Transovo' ? ` · ${data.brandName}` : ''}
      </footer>
    </div>
  )
}
