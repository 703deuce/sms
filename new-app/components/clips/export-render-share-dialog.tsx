'use client'

import { useState } from 'react'
import { Copy, Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createRenderShareLink, revokeRenderShareLink } from '@/lib/clips-api'

export function ExportRenderShareDialog({
  renderId,
  open,
  onOpenChange,
}: {
  renderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [allowDownload, setAllowDownload] = useState(true)

  const reset = () => {
    setShareUrl(null)
    setAllowDownload(true)
  }

  const onCreate = async () => {
    if (!renderId || busy) return
    setBusy(true)
    try {
      const data = await createRenderShareLink(renderId, { allowDownload })
      setShareUrl(data.shareUrl)
      toast.success('Share link ready')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create share link')
    } finally {
      setBusy(false)
    }
  }

  const onRevoke = async () => {
    if (!renderId || busy) return
    setBusy(true)
    try {
      await revokeRenderShareLink(renderId)
      reset()
      toast.success('Share link revoked')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not revoke link')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share export</DialogTitle>
          <DialogDescription>
            Anyone with the link can view this render. The link includes a private access key in the URL.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Label htmlFor="share-allow-download" className="text-sm">
            Allow download
          </Label>
          <Switch
            id="share-allow-download"
            checked={allowDownload}
            onCheckedChange={setAllowDownload}
            disabled={busy || Boolean(shareUrl)}
          />
        </div>
        {shareUrl ? (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Share URL</Label>
            <p className="break-all rounded-md bg-muted px-2 py-2 text-xs">{shareUrl}</p>
          </div>
        ) : null}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {shareUrl ? (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void onRevoke()}>
                Revoke link
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="export-share-open"
                onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
              >
                Open
              </Button>
              <Button type="button" data-testid="export-share-copy" onClick={() => void copy()}>
                <Copy className="size-4" aria-hidden />
                Copy link
              </Button>
            </>
          ) : (
            <Button type="button" className="w-full sm:ml-auto" disabled={busy || !renderId} data-testid="export-share-create" onClick={() => void onCreate()}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              Create link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
