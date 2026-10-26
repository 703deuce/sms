'use client'

import { useAudioWaveformPeaks } from '@/components/clips/editor/use-audio-waveform'

export function AudioWaveformLane({ videoUrl, className }: { videoUrl: string | null; className?: string }) {
  const peaks = useAudioWaveformPeaks(videoUrl, 140)
  if (!peaks.length) {
    return <div className={className} aria-hidden />
  }
  return (
    <svg className={className} viewBox={`0 0 ${peaks.length} 20`} preserveAspectRatio="none" aria-hidden>
      {peaks.map((p, i) => (
        <rect key={i} x={i} y={10 - p * 9} width={0.9} height={p * 18 + 0.5} fill="currentColor" className="text-emerald-400/80" />
      ))}
    </svg>
  )
}
