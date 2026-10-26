'use client'

import { useId } from 'react'

export function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const gradId = useId()
  const raw = score <= 10 ? score * 10 : score
  const s = Math.max(0, Math.min(100, Math.round(raw)))
  const r = 15
  const c = 2 * Math.PI * r
  const tone = s >= 75 ? `url(#${gradId})` : s >= 50 ? 'var(--lane-caption)' : 'var(--muted-foreground)'

  return (
    <div
      data-testid="score-ring"
      className="relative grid place-items-center rounded-full bg-black/55 backdrop-blur-sm"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Virality score ${s} out of 100`}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.25 290)" />
            <stop offset="55%" stopColor="oklch(0.67 0.26 340)" />
            <stop offset="100%" stopColor="oklch(0.8 0.17 60)" />
          </linearGradient>
        </defs>
        <circle cx="18" cy="18" r={r} fill="none" stroke="white" strokeOpacity=".15" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - s / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="relative text-[11px] font-semibold tabular-nums text-white">{s}</span>
    </div>
  )
}
