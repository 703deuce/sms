'use client'

import { useEffect, useRef } from 'react'

/** Mix isolated speech over the preview video when Studio Sound is ready. */
export function StudioSoundPreview({
  videoRef,
  isolatedUrl,
  mix,
  enabled,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isolatedUrl: string | null
  mix: number
  enabled: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !enabled || !isolatedUrl) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (video) video.muted = false
      return
    }

    const audio = new Audio(isolatedUrl)
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audio.volume = Math.max(0, Math.min(1, mix))
    audioRef.current = audio
    video.muted = true
    video.volume = Math.max(0, Math.min(1, 1 - mix))

    const sync = () => {
      if (Math.abs(audio.currentTime - video.currentTime) > 0.25) {
        audio.currentTime = video.currentTime
      }
    }

    const onPlay = () => {
      sync()
      void audio.play().catch(() => {})
    }
    const onPause = () => audio.pause()
    const onSeek = () => sync()

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeking', onSeek)
    video.addEventListener('timeupdate', sync)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeking', onSeek)
      video.removeEventListener('timeupdate', sync)
      audio.pause()
      audioRef.current = null
      video.muted = false
    }
  }, [videoRef, isolatedUrl, mix, enabled])

  return null
}
