'use client'

import { useCallback, useState } from 'react'

/** Cover-crop B-roll in preview using real video dimensions after metadata loads. */
export function BrollPreviewVideo({
  src,
  videoRef,
  className,
  style,
}: {
  src: string
  videoRef: (el: HTMLVideoElement | null) => void
  className?: string
  style?: React.CSSProperties
}) {
  const [cropStyle, setCropStyle] = useState<React.CSSProperties>({})

  const onMeta = useCallback((el: HTMLVideoElement) => {
    const pw = el.parentElement?.clientWidth || 0
    const ph = el.parentElement?.clientHeight || 0
    const vw = el.videoWidth
    const vh = el.videoHeight
    if (!pw || !ph || !vw || !vh) return
    const scale = Math.max(pw / vw, ph / vh)
    const dw = vw * scale
    const dh = vh * scale
    setCropStyle({
      width: dw,
      height: dh,
      left: (pw - dw) / 2,
      top: (ph - dh) / 2,
      position: 'absolute',
      maxWidth: 'none',
    })
  }, [])

  return (
    <video
      ref={(el) => {
        videoRef(el)
        if (el) onMeta(el)
      }}
      src={src}
      className={className}
      style={{ ...cropStyle, ...style }}
      muted
      playsInline
      preload="auto"
      onLoadedMetadata={(e) => onMeta(e.currentTarget)}
    />
  )
}
