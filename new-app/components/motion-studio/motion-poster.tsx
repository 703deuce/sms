'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { MsVisualType } from '@/lib/motion-studio/types'

/**
 * Code-rendered poster frames for Motion Studio scenes until a real render thumbnail exists.
 * Pure SVG on theme tokens (chart / lane hues on the always-dark `--ms-poster-*` canvas):
 * no network, no hotlinks, no paid generation. Deterministic per `seed` so a scene keeps its look.
 */

const W = 320
const H = 180
const INK = 'var(--ms-poster-ink)'

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: string) {
  let x = hash(seed) || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 10_000) / 10_000
  }
}

const ACCENTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const

function wrap(text: string, max: number, lines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      out.push(cur)
      cur = w
      if (out.length === lines) break
    } else cur = (cur + ' ' + w).trim()
  }
  if (out.length < lines && cur) out.push(cur)
  if (out.length === lines && words.join(' ').length > out.join(' ').length) out[lines - 1] = out[lines - 1]!.replace(/[.,;:!?]?$/, '…')
  return out
}

export type MotionPosterProps = {
  kind: MsVisualType
  seed: string
  title: string
  eyebrow?: string
  /** Thumbnail mode: drops small type that would not be legible. */
  small?: boolean
  /** Slow Ken Burns drift on photo frames (respects reduced motion). */
  animate?: boolean
  /** Title/eyebrow lower third on non-title frames (off where the card already prints the title). */
  showCaption?: boolean
  className?: string
}

export function MotionPoster({ kind, seed, title, eyebrow, small = false, animate = false, showCaption = true, className }: MotionPosterProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const r = rng(`${seed}:${kind}`)
  const accent = ACCENTS[hash(seed) % ACCENTS.length]!
  const id = (n: string) => `msp-${uid}-${n}`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn('block size-full select-none', className)}
      role="img"
      aria-label={`${kindLabel(kind)} frame: ${title}`}
      data-testid="ms-poster"
      data-kind={kind}
    >
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ms-poster-bg-2)" />
          <stop offset="1" stopColor="var(--ms-poster-bg)" />
        </linearGradient>
        <radialGradient id={id('glow')} cx="0.75" cy="0.2" r="0.8">
          <stop offset="0" stopColor={accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('vig')} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="var(--ms-poster-bg)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--ms-poster-bg)" stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id={id('fade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="var(--ms-poster-bg)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--ms-poster-bg)" stopOpacity="0.9" />
        </linearGradient>
        {!small ? (
          <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.06" />
            </feComponentTransfer>
          </filter>
        ) : null}
      </defs>
      <rect width={W} height={H} fill={`url(#${id('bg')})`} />
      <rect width={W} height={H} fill={`url(#${id('glow')})`} />
      {kind === 'chart' ? <ChartArt r={r} accent={accent} id={id} small={small} /> : null}
      {kind === 'photo' ? <PhotoArt r={r} accent={accent} id={id} animate={animate} /> : null}
      {kind === 'text' ? <TitleArt accent={accent} title={title} eyebrow={eyebrow} small={small} /> : null}
      {kind === 'map' ? <MapArt r={r} accent={accent} /> : null}
      {kind === 'diagram' ? <DiagramArt r={r} accent={accent} small={small} /> : null}
      {kind === 'footage' || kind === 'interview' || kind === 'cinematic' ? <FootageArt r={r} accent={accent} interview={kind === 'interview'} /> : null}
      <rect width={W} height={H} fill={`url(#${id('vig')})`} pointerEvents="none" />
      {kind !== 'text' && !small && showCaption ? (
        <g>
          <rect width={W} height={H} fill={`url(#${id('fade')})`} />
          {eyebrow ? (
            <text x="16" y="138" fill={accent} fontSize="7.5" fontWeight="600" letterSpacing="1.4" className="font-sans uppercase">
              {eyebrow}
            </text>
          ) : null}
          {wrap(title, 34, 2).map((line, i) => (
            <text key={i} x="16" y={152 + i * 14} fill={INK} fontSize="12.5" fontWeight="600" className="font-sans">
              {line}
            </text>
          ))}
        </g>
      ) : null}
      {!small ? <rect width={W} height={H} filter={`url(#${id('grain')})`} opacity="0.9" pointerEvents="none" /> : null}
    </svg>
  )
}

function kindLabel(kind: MsVisualType): string {
  return kind === 'chart' ? 'Chart' : kind === 'photo' ? 'Photo' : kind === 'text' ? 'Title card' : kind === 'map' ? 'Map' : kind === 'diagram' ? 'Diagram' : kind === 'interview' ? 'Interview' : 'Footage'
}

type Rand = () => number

function ChartArt({ r, accent, id, small }: { r: Rand; accent: string; id: (n: string) => string; small: boolean }) {
  // A long, quiet baseline that breaks into a squeeze-style spike, then settles.
  const n = 28
  const spikeAt = 17 + Math.floor(r() * 5)
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const x = 18 + (i / (n - 1)) * (W - 36)
    let v = 0.12 + r() * 0.06 + i * 0.004
    const d = i - spikeAt
    if (d >= 0 && d < 4) v = [0.55, 0.92, 0.7, 0.5][d]! + r() * 0.05
    if (d >= 4) v = 0.38 + r() * 0.08
    pts.push([x, 120 - v * 92])
  }
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts.at(-1)![0].toFixed(1)},120 L${pts[0]![0].toFixed(1)},120 Z`
  const peak = pts[spikeAt + 1]!
  const base = pts[Math.max(0, spikeAt - 2)]!
  const pct = Math.round(((120 - peak[1]) / Math.max(1, 120 - base[1]) - 1) * 100)
  return (
    <g>
      <defs>
        <linearGradient id={id('area')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.45" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="18" x2={W - 18} y1={28 + i * 30.7} y2={28 + i * 30.7} stroke={INK} strokeOpacity="0.07" strokeWidth="0.6" />
      ))}
      <path d={area} fill={`url(#${id('area')})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="5" strokeOpacity="0.18" strokeLinejoin="round" />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={peak[0]} x2={peak[0]} y1={peak[1]} y2="120" stroke={INK} strokeOpacity="0.25" strokeDasharray="2 2" strokeWidth="0.6" />
      <circle cx={peak[0]} cy={peak[1]} r="7" fill={accent} fillOpacity="0.2" />
      <circle cx={peak[0]} cy={peak[1]} r="2.6" fill={INK} stroke={accent} strokeWidth="1.2" />
      {!small ? (
        <g className="font-sans">
          <rect x={peak[0] - 62} y={peak[1] - 6} width="52" height="16" rx="3" fill="var(--ms-poster-bg)" fillOpacity="0.8" stroke={accent} strokeOpacity="0.5" strokeWidth="0.6" />
          <text x={peak[0] - 36} y={peak[1] + 5} textAnchor="middle" fill={INK} fontSize="8" fontWeight="700" className="tabular-nums">
            {`+${pct.toLocaleString('en-US')}%`}
          </text>
          {['JAN', 'FEB', 'MAR'].map((m, i) => (
            <text key={m} x={18 + i * ((W - 36) / 2)} y="129" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fill={INK} fillOpacity="0.45" fontSize="6" letterSpacing="0.8">
              {m}
            </text>
          ))}
        </g>
      ) : null}
    </g>
  )
}

function PhotoArt({ r, accent, id, animate }: { r: Rand; accent: string; id: (n: string) => string; animate: boolean }) {
  // An evening skyline "photograph" with a slow push-in (Ken Burns) inside a print border.
  const buildings: { x: number; w: number; h: number }[] = []
  let x = -4
  while (x < W + 10) {
    const w = 14 + r() * 26
    buildings.push({ x, w, h: 40 + r() * 80 })
    x += w + 1 + r() * 3
  }
  return (
    <g>
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="var(--chart-4)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--chart-5)" stopOpacity="0.35" />
        </linearGradient>
        <clipPath id={id('clip')}>
          <rect x="10" y="10" width={W - 20} height={H - 20} rx="3" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id('clip')})`}>
        <g className={animate ? 'motion-safe:animate-ken-burns' : undefined} style={{ transformBox: 'fill-box', transformOrigin: '60% 45%' }}>
          <rect x="0" y="0" width={W} height={H} fill="var(--ms-poster-bg)" />
          <rect x="0" y="0" width={W} height={H} fill={`url(#${id('sky')})`} />
          <circle cx={W * 0.68} cy="62" r="22" fill="var(--chart-4)" fillOpacity="0.55" />
          <circle cx={W * 0.68} cy="62" r="40" fill="var(--chart-4)" fillOpacity="0.12" />
          {buildings.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={H - b.h} width={b.w} height={b.h} fill="var(--ms-poster-bg)" fillOpacity={0.82 + (i % 3) * 0.06} />
              {Array.from({ length: Math.floor(b.h / 12) }, (_, j) =>
                (i + j) % 3 === 0 ? <rect key={j} x={b.x + 3} y={H - b.h + 6 + j * 12} width={b.w - 6} height="1.6" fill="var(--chart-4)" fillOpacity="0.35" /> : null,
              )}
            </g>
          ))}
        </g>
      </g>
      <rect x="10" y="10" width={W - 20} height={H - 20} rx="3" fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="1.2" />
      <rect x="6" y="6" width={W - 12} height={H - 12} rx="5" fill="none" stroke={accent} strokeOpacity="0.25" strokeWidth="0.6" />
    </g>
  )
}

function TitleArt({ accent, title, eyebrow, small }: { accent: string; title: string; eyebrow?: string; small: boolean }) {
  const lines = wrap(title, small ? 12 : 22, small ? 2 : 3)
  const size = small ? 34 : lines.length > 2 ? 19 : 22
  const top = H / 2 - ((lines.length - 1) * size * 1.15) / 2 + (small ? 6 : 8)
  return (
    <g className="font-sans">
      <rect x="24" y={top - size - (small ? 8 : 14)} width={small ? 40 : 28} height={small ? 4 : 2.5} rx="1.25" fill={accent} />
      {eyebrow && !small ? (
        <text x="58" y={top - size - 11} fill={accent} fontSize="7.5" fontWeight="600" letterSpacing="1.4" className="uppercase">
          {eyebrow}
        </text>
      ) : null}
      {lines.map((l, i) => (
        <text key={i} x="24" y={top + i * size * 1.15} fill={INK} fontSize={size} fontWeight="700" letterSpacing="-0.4">
          {l}
        </text>
      ))}
      <rect x="24" y={H - 26} width={W - 48} height="0.6" fill={INK} fillOpacity="0.15" />
    </g>
  )
}

function MapArt({ r, accent }: { r: Rand; accent: string }) {
  const blobs = [
    { cx: 80, cy: 70, rx: 50, ry: 32 },
    { cx: 112, cy: 128, rx: 20, ry: 30 },
    { cx: 190, cy: 64, rx: 60, ry: 28 },
    { cx: 186, cy: 112, rx: 22, ry: 26 },
    { cx: 262, cy: 128, rx: 22, ry: 12 },
  ]
  const dots: [number, number][] = []
  for (let y = 18; y < H - 14; y += 6) {
    for (let x = 14; x < W - 10; x += 6) {
      if (blobs.some((b) => ((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2 < 1)) dots.push([x, y])
    }
  }
  const a = dots[Math.floor(r() * dots.length * 0.3)] ?? [80, 70]
  const b = dots[Math.floor(dots.length * 0.55 + r() * dots.length * 0.3)] ?? [200, 64]
  const mx = (a[0] + b[0]) / 2
  const my = Math.min(a[1], b[1]) - 40
  return (
    <g>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.05" fill={INK} fillOpacity="0.22" />
      ))}
      <path d={`M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`} fill="none" stroke={accent} strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" />
      {[a, b].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill={accent} fillOpacity="0.15" />
          <circle cx={x} cy={y} r="3" fill={INK} stroke={accent} strokeWidth="1.4" />
        </g>
      ))}
    </g>
  )
}

function DiagramArt({ r, accent, small }: { r: Rand; accent: string; small: boolean }) {
  const labels = ['Origin', 'Catalyst', 'Reaction', 'Outcome']
  const hot = Math.floor(r() * 4)
  const nodes = [
    { x: 40, y: 40 },
    { x: 196, y: 30 },
    { x: 60, y: 96 },
    { x: 214, y: 92 },
  ]
  return (
    <g className="font-sans">
      {[
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
        [0, 3],
      ].map(([i, j], k) => {
        const p = nodes[i!]!
        const q = nodes[j!]!
        return (
          <path
            key={k}
            d={`M${p.x + 33},${p.y + 12} C${(p.x + q.x) / 2 + 33},${p.y + 12} ${(p.x + q.x) / 2 + 33},${q.y + 12} ${q.x + 33},${q.y + 12}`}
            fill="none"
            stroke={k === hot ? accent : INK}
            strokeOpacity={k === hot ? 0.9 : 0.25}
            strokeWidth={k === hot ? 1.4 : 0.8}
          />
        )
      })}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width="66" height="24" rx="6" fill="var(--ms-poster-bg)" stroke={i === hot ? accent : INK} strokeOpacity={i === hot ? 1 : 0.3} strokeWidth={i === hot ? 1.3 : 0.8} />
          {!small ? (
            <text x={n.x + 33} y={n.y + 15} textAnchor="middle" fill={INK} fillOpacity={i === hot ? 1 : 0.75} fontSize="7.5" fontWeight="600">
              {labels[i]}
            </text>
          ) : (
            <rect x={n.x + 14} y={n.y + 10} width="38" height="4" rx="2" fill={INK} fillOpacity="0.4" />
          )}
        </g>
      ))}
    </g>
  )
}

function FootageArt({ r, accent, interview }: { r: Rand; accent: string; interview: boolean }) {
  const bokeh = Array.from({ length: 9 }, () => ({ x: r() * W, y: 20 + r() * 90, s: 6 + r() * 18, o: 0.08 + r() * 0.18 }))
  return (
    <g>
      {bokeh.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.s} fill={i % 2 ? accent : 'var(--chart-4)'} fillOpacity={b.o} />
      ))}
      {interview ? (
        <g fill="var(--ms-poster-bg)" fillOpacity="0.92">
          <circle cx="206" cy="78" r="22" />
          <path d="M150,180 C150,128 176,108 206,108 C236,108 262,128 262,180 Z" />
        </g>
      ) : (
        <path d={`M0,150 C60,${120 + r() * 10} 120,${132 + r() * 10} 180,128 C240,124 280,${136 + r() * 6} ${W},132 L${W},${H} L0,${H} Z`} fill="var(--ms-poster-bg)" fillOpacity="0.9" />
      )}
      <rect x="0" y="0" width={W} height="14" fill="var(--ms-poster-bg)" />
      <rect x="0" y={H - 14} width={W} height="14" fill="var(--ms-poster-bg)" />
      <circle cx="20" cy="24" r="2.4" fill="var(--chart-5)" />
    </g>
  )
}
