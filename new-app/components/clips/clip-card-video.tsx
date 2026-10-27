'use client'

import { useCallback, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { playWithSound, pauseVideo } from '@/lib/clips/video-playback'

export function ClipCardVideo({
  clipId,
  previewUrl,
  posterUrl,
}: {
  clipId: string
  previewUrl: string | null
  posterUrl: string | null
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [needsUnmute, setNeedsUnmute] = useState(false)
  const [controlsRevealed, setControlsRevealed] = useState(false)
  const [volume, setVolume] = useState(100)

  const firePreviewEvent = useCallback(() => {
    void fetch(`/api/clips/clips/${clipId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'preview_play' }),
    }).catch(() => {})
  }, [clipId])

  const togglePlay = async () => {
    const v = ref.current
    if (!v || !previewUrl) return
    if (!v.paused) {
      pauseVideo(v)
      setPlaying(false)
      return
    }
    setControlsRevealed(true)
    firePreviewEvent()
    const mode = await playWithSound(v)
    if (mode === 'muted') {
      v.muted = true
      setMuted(true)
      setNeedsUnmute(true)
    } else {
      setMuted(false)
      setNeedsUnmute(false)
    }
    setPlaying(!v.paused)
  }

  const toggleMute = async () => {
    const v = ref.current
    if (!v) return
    if (v.muted || needsUnmute) {
      v.muted = false
      v.volume = volume / 100
      setMuted(false)
      setNeedsUnmute(false)
      if (v.paused) {
        firePreviewEvent()
        const mode = await playWithSound(v)
        if (mode === 'muted') {
          setNeedsUnmute(true)
          setMuted(true)
        }
      }
      setPlaying(!v.paused)
    } else {
      v.muted = true
      setMuted(true)
    }
  }

  const onVolume = (val: number) => {
    const v = ref.current
    setVolume(val)
    if (v) {
      v.volume = val / 100
      if (val > 0) {
        v.muted = false
        setMuted(false)
        setNeedsUnmute(false)
      }
    }
  }

  const hoverPreview = async () => {
    const v = ref.current
    if (!v || playing || !previewUrl) return
    v.muted = true
    setMuted(true)
    try {
      await v.play()
    } catch {
      /* ignore hover preview failure */
    }
  }

  const hoverLeave = () => {
    const v = ref.current
    if (!v || playing) return
    v.pause()
    v.currentTime = 0
  }

  if (!previewUrl) return null

  return (
    <div className="relative size-full">
      <video
        ref={ref}
        className="size-full cursor-pointer object-cover"
        poster={posterUrl ?? undefined}
        src={previewUrl}
        preload="metadata"
        muted
        playsInline
        loop
        data-testid="clip-card-video"
        onMouseEnter={() => void hoverPreview()}
        onMouseLeave={hoverLeave}
      />
      <div
        className={
          playing || controlsRevealed
            ? 'absolute bottom-2 left-2 right-2 flex items-center gap-1 rounded-md bg-black/60 p-1.5 opacity-100 transition'
            : 'absolute bottom-2 left-2 right-2 flex items-center gap-1 rounded-md bg-black/60 p-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100'
        }
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-white"
          onClick={(e) => {
            e.stopPropagation()
            void togglePlay()
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
        {playing || controlsRevealed ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 text-white"
              onClick={(e) => {
                e.stopPropagation()
                void toggleMute()
              }}
              aria-label={muted || needsUnmute ? 'Unmute' : 'Mute'}
            >
              {muted || needsUnmute ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </Button>
            <Slider className="min-w-0 flex-1" min={0} max={100} value={[volume]} onValueChange={(v) => onVolume(Array.isArray(v) ? v[0] ?? 100 : 100)} aria-label="Volume" />
            {needsUnmute ? (
              <button
                type="button"
                className="text-[10px] font-medium text-amber-300 underline"
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleMute()
                }}
              >
                Unmute
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
