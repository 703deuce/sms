'use client'

import { corsMediaProps } from '@/components/clips/editor/g4/media-cors'
import type { ResolvedCanvasBg } from '@/lib/clips/canvas-bg'

export function CanvasBgFill({
  bg,
  imageUrl,
}: {
  bg: ResolvedCanvasBg
  imageUrl?: string | null
}) {
  if (bg.kind === 'color') {
    return (
      <div
        data-testid="preview-canvas-bg"
        className="pointer-events-none absolute inset-0"
        style={{ background: bg.hex }}
        aria-hidden
      />
    )
  }
  if (bg.kind === 'image' && imageUrl) {
    return (
      <img
        {...corsMediaProps(imageUrl)}
        src={imageUrl}
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-cover"
        data-testid="preview-canvas-bg"
        aria-hidden
      />
    )
  }
  if (bg.kind === 'image') {
    return <div data-testid="preview-canvas-bg" className="pointer-events-none absolute inset-0 bg-black" aria-hidden />
  }
  return null
}
