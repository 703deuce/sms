'use client'

import type { TemplateSpecV2 } from '@/lib/clips/templates/geometry'

/** Presentational multi-panel preview (P2). */
export function TemplateStage({
  spec,
  videoUrl,
  posterUrl,
  onReady,
}: {
  spec: TemplateSpecV2
  videoUrl?: string | null
  posterUrl?: string | null
  onReady?: () => void
}) {
  if (!videoUrl) {
    return posterUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={posterUrl} alt="" className="size-full object-cover" />
    ) : null
  }
  return (
    <div className="relative size-full overflow-hidden bg-black" data-testid="template-stage">
      {spec.panels.map((p, i) => (
        <div
          key={i}
          className="absolute overflow-hidden"
          style={{ left: p.dest.x, top: p.dest.y, width: p.dest.w, height: p.dest.h }}
        >
          <video
            src={videoUrl}
            className="max-w-none"
            muted
            playsInline
            onLoadedData={() => onReady?.()}
          />
        </div>
      ))}
    </div>
  )
}
