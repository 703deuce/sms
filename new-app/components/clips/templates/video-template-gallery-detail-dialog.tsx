'use client'

import Link from 'next/link'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RenderedTemplateCardPreview, AnimatedTemplateCardPreview } from '@/components/clips/templates/video-templates-gallery-previews'

export function VideoTemplateGalleryDetailDialog({
  item,
  onClose,
}: {
  item: VideoTemplateRelease | null
  onClose: () => void
}) {
  const open = Boolean(item)
  const seconds = item ? (item.family.totalFrames / item.family.fps).toFixed(1).replace(/\.0$/, '') : ''
  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        {item ? (
          <>
            <div className="border-b bg-black">
              {item.previewMedia ? (
                <RenderedTemplateCardPreview item={item} />
              ) : (
                <AnimatedTemplateCardPreview item={item} />
              )}
            </div>
            <DialogHeader className="space-y-2 px-5 pb-2 pt-4 text-left">
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription className="text-sm">{item.description}</DialogDescription>
              <p className="text-xs text-muted-foreground">
                {item.family.slots.length} materials · {seconds}s · {item.family.aspects.join(', ')}
              </p>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 px-5 pb-5">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Link
                href={'/app/clips/video-templates/' + encodeURIComponent(item.id)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                onClick={onClose}
              >
                Use template
              </Link>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
