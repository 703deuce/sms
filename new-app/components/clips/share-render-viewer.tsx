'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { renderSharePublicApiPath } from '@/lib/clips/export-share'

type Payload = {
  title: string
  filename: string
  playbackUrl: string | null
  playbackStatus: 'ready' | 'unavailable'
  allowDownload: boolean
}

export function ShareRenderViewer({ slug }: { slug: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = typeof window !== 'undefined' ? window.location.search : ''
      const res = await fetch(`${renderSharePublicApiPath(slug)}${qs}`, { credentials: 'omit' })
      const json = (await res.json()) as { data?: Payload }
      setData(json.data ?? null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-8 animate-spin" aria-hidden />
        <span className="sr-only">Loading shared export</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-lg font-medium">This link is unavailable</p>
        <p className="text-sm text-muted-foreground">It may have expired or been revoked.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{data.title}</h1>
          <p className="text-sm text-muted-foreground">Shared export</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
          <Copy className="size-4" aria-hidden />
          Copy link
        </Button>
      </header>
      {data.playbackUrl ? (
        <video
          className="w-full rounded-xl border border-border bg-black"
          controls
          playsInline
          src={data.playbackUrl}
          aria-label={data.title}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Preview unavailable
        </p>
      )}
      {data.allowDownload && data.playbackUrl ? (
        <Button
          nativeButton={false}
          render={<a href={data.playbackUrl} download={data.filename} rel="noopener" />}
        >
          <Download className="size-4" aria-hidden />
          Download
        </Button>
      ) : null}
    </div>
  )
}
