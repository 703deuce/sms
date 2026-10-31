'use client'

import type { ClipEditsV2 } from '@/lib/clips/edits'

/**
 * Preview of the export's hook title (worker hook_overlay.py: ASS \an8 at (w/2, 11 % h),
 * DejaVu Sans bold, size 7.2 % of min(w, h), outline 4 / shadow 2, \fad(180,220), brand colour).
 * Frame-sized so E3 Text keyframes use the same transform origin as the export (\an8 anchor);
 * opacity / transform are driven per tick by motion-preview.
 */
export function HookOverlayPreview({
  edits,
  boxW,
  boxH,
  elRef,
}: {
  edits: ClipEditsV2
  boxW: number
  boxH: number
  elRef: (el: HTMLDivElement | null) => void
}) {
  const ho = edits.hookOverlay
  if (!ho?.enabled || !ho.text?.trim() || boxW <= 0 || boxH <= 0) return null
  const brand = (edits.brand || {}) as { primaryColor?: string }
  const color = brand.primaryColor || '#FACC15'
  const font = 0.072 * Math.min(boxW, boxH)
  const outline = Math.max(1, (4 * boxH) / 1280)
  const shadow = Math.max(1, (2 * boxH) / 1280)
  return (
    <div
      ref={elRef}
      className="pointer-events-none absolute inset-0 z-[22]"
      style={{ transformOrigin: '50% 11%', opacity: 0, visibility: 'hidden' }}
      data-testid="preview-hook-overlay"
      data-libass-for="hook"
      data-libass-ghost="all"
      aria-hidden
    >
      <div
        className="absolute text-center font-bold leading-tight"
        style={{
          top: '11%',
          left: '8%',
          right: '8%',
          color,
          fontFamily: '"DejaVu Sans", Verdana, sans-serif',
          fontSize: font,
          WebkitTextStroke: `${outline}px #000`,
          paintOrder: 'stroke fill',
          textShadow: `${shadow}px ${shadow}px 0 rgba(0,0,0,0.41)`,
          whiteSpace: 'pre-wrap',
        }}
      >
        {ho.text}
      </div>
    </div>
  )
}
