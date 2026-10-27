'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { brollCoverCropStyle } from '@/lib/clips/broll-cover-crop'

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
  const elRef = useRef<HTMLVideoElement | null>(null)

  const onMeta = useCallback((el: HTMLVideoElement) => {
    const pw = el.parentElement?.clientWidth || 0
    const ph = el.parentElement?.clientHeight || 0
    const box = brollCoverCropStyle(pw, ph, el.videoWidth, el.videoHeight)
    if (!box) return
    setCropStyle({
      width: box.width,
      height: box.height,
      left: box.left,
      top: box.top,
      position: 'absolute',
      maxWidth: 'none',
    })
  }, [])

  useEffect(() => {
    const el = elRef.current
    if (!el || !src) return
    el.load()
  }, [src])

  return (
    <video
      ref={(el) => {
        elRef.current = el
        videoRef(el)
      }}
      src={src}
      className={className}
      style={{ ...cropStyle, ...style }}
      muted
      playsInline
      preload="auto"
      onLoadedMetadata={(e) => onMeta(e.currentTarget)}
      onLoadedData={(e) => onMeta(e.currentTarget)}
    />
  )
}
