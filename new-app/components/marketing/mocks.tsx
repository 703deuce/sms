import type { ReactNode } from 'react'
import { ProductFrame } from '@/components/marketing/product-frame'

export function ClipsHeroMock() {
  return (
    <ProductFrame label="Transovo Clips · Story review">
      <div className="bg-[oklch(0.16_0.008_285)]">
        <SourceScrubber />
        <StoryStitchRail />
        <div className="flex items-end justify-center gap-2.5 border-t border-border/80 px-3 pb-4 pt-3 sm:gap-3.5 sm:px-4">
          <ClipCard
            title="The setup"
            time="00:42"
            caption="So here’s what actually happened on set that week."
            why="Opens on a clear hook, then lands the answer."
            layout="Speaker follow"
            offset="hidden sm:block"
            dim
          />
          <ClipCard
            title="Story · 0:58"
            time="00:58"
            caption="We cut three days apart — and the argument still holds."
            why="Stitches the setup, the pushback, and a complete-sentence payoff."
            layout="9:16 · Story"
            featured
          />
          <ClipCard
            title="The payoff"
            time="00:31"
            caption="That’s the line I wish I had said in the moment."
            why="Ends on a finished thought, not a mid-sentence cut."
            layout="Split"
            offset="hidden sm:block"
            dim
          />
        </div>
      </div>
    </ProductFrame>
  )
}

function SourceScrubber() {
  const bars = Array.from({ length: 96 }, (_, i) => {
    const wave = 8 + Math.abs(Math.sin(i / 3.4) * 14) + ((i * 5) % 7)
    return Math.min(26, wave)
  })
  const segments = [
    { left: '6%', width: '9%', label: 'Setup', time: '02:14', tone: 'from-[oklch(0.62_0.22_295)] to-[oklch(0.7_0.18_330)]' },
    { left: '36%', width: '8%', label: 'Turn', time: '18:41', tone: 'from-[oklch(0.66_0.2_340)] to-[oklch(0.72_0.16_60)]' },
    { left: '82%', width: '10%', label: 'Payoff', time: '41:07', tone: 'from-[oklch(0.72_0.16_60)] to-[oklch(0.78_0.14_80)]' },
  ]
  return (
    <div className="px-4 pt-4 sm:px-5 sm:pt-5" aria-hidden>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">Source</span>
          <span className="text-xs font-medium text-foreground">episode-04.mp4</span>
          <span className="font-mono text-[0.65rem] text-muted-foreground">48:12</span>
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground">
          3 moments → one Story
        </span>
      </div>
      <div className="relative rounded-xl border border-border bg-panel px-3 pb-8 pt-2">
        <div className="mb-1 flex justify-between font-mono text-[0.55rem] text-muted-foreground">
          {['0:00', '12:00', '24:00', '36:00', '48:12'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="relative h-14 overflow-hidden rounded-md bg-muted/80">
          <svg className="absolute inset-0 h-full w-full text-foreground/35" viewBox="0 0 288 40" preserveAspectRatio="none">
            {bars.map((h, i) => (
              <rect
                key={i}
                x={i * 3 + 1}
                y={(40 - h) / 2}
                width="2"
                height={h}
                fill="currentColor"
                rx="0.5"
              />
            ))}
          </svg>
          {segments.map((seg) => (
            <div
              key={seg.label}
              className={`absolute inset-y-0 rounded-sm bg-gradient-to-r ${seg.tone} opacity-80 ring-1 ring-white/30`}
              style={{ left: seg.left, width: seg.width }}
            />
          ))}
          <div className="absolute inset-y-0 left-[42%] w-px bg-brand-foreground/90" />
        </div>
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="absolute bottom-1.5 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `calc(${seg.left} + ${seg.width} / 2)` }}
          >
            <span className="h-2 w-px bg-brand/70" />
            <span className="whitespace-nowrap font-mono text-[0.55rem] text-foreground">
              {seg.label} {seg.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClipCard({
  title,
  time,
  caption,
  why,
  layout,
  featured,
  dim,
  offset,
}: {
  title: string
  time: string
  caption: string
  why: string
  layout: string
  featured?: boolean
  dim?: boolean
  offset?: string
}) {
  return (
    <div
      className={`w-[6.8rem] shrink-0 sm:w-[8rem] ${offset ?? ''} ${dim ? 'opacity-70' : ''} ${featured ? 'z-10 scale-[1.03]' : ''}`}
      aria-hidden
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[oklch(0.28_0.05_295)] via-[oklch(0.2_0.02_285)] to-[oklch(0.14_0.01_285)] shadow-md">
        <div className="flex items-center justify-between px-2.5 pt-2.5">
          <span className="rounded-full bg-black/40 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-white/80">
            {layout}
          </span>
          <span className="font-mono text-[0.55rem] text-white/60">{time}</span>
        </div>
        <div className="mx-auto mt-5 size-14 rounded-full bg-gradient-to-br from-[oklch(0.72_0.12_80)] to-[oklch(0.45_0.08_40)] ring-2 ring-white/20" />
        <div className="mx-auto mt-2.5 h-1.5 w-14 rounded-full bg-white/20" />
        <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-10">
          <p className="rounded-md bg-black/55 px-1.5 py-1 text-center text-[0.62rem] font-semibold leading-snug text-white">
            {caption}
          </p>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-border bg-card px-2 py-1.5">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-brand">Why this moment</p>
        <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">{why}</p>
        <p className="mt-1 truncate text-[0.7rem] font-medium text-foreground">{title}</p>
      </div>
    </div>
  )
}

function StoryStitchRail() {
  const steps = [
    { t: '02:14', label: 'Setup', body: 'The hook that starts the thread.' },
    { t: '18:41', label: 'Turn', body: 'A later rebuttal, kept in context.' },
    { t: '41:07', label: 'Payoff', body: 'Ends when the thought is finished.' },
  ]
  return (
    <div className="px-3 pb-1 sm:px-4" aria-hidden>
      <div className="flex flex-nowrap items-center gap-2 overflow-hidden rounded-xl border border-border bg-card/70 px-3 py-2.5">
        <div className="flex shrink-0 flex-col justify-center pr-1">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-brand">Story stitch</p>
          <p className="text-[0.7rem] font-medium text-foreground">3 moments, one clip</p>
        </div>
        {steps.map((step, i) => (
          <div key={step.t} className="flex min-w-0 flex-1 items-center gap-1.5">
            {i > 0 ? <span className="hidden h-px w-2 shrink-0 bg-border md:block" /> : null}
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-gradient text-[0.6rem] font-semibold text-brand-foreground">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {step.label} <span className="font-mono text-[0.6rem] text-muted-foreground">{step.t}</span>
              </p>
              <p className="hidden truncate text-[0.65rem] text-muted-foreground xl:block">{step.body}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1 self-center rounded-md border border-border bg-background px-2 py-1">
          {['30s', '60s', '90s'].map((d) => (
            <span
              key={d}
              className={`rounded px-1.5 py-0.5 font-mono text-[0.58rem] ${d === '60s' ? 'bg-brand-gradient text-brand-foreground' : 'text-muted-foreground'}`}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}


export function LayoutsMock() {
  const layouts = [
    { id: 'Auto', frame: 'auto' },
    { id: 'Speaker follow', frame: 'follow' },
    { id: 'Split', frame: 'split' },
    { id: 'Grid', frame: 'grid' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
      {layouts.map((layout) => (
        <div key={layout.id} className="rounded-xl border border-border bg-card p-2.5">
          <div className="aspect-[9/16] overflow-hidden rounded-lg bg-[oklch(0.18_0.01_285)] p-1.5">
            {layout.frame === 'follow' ? (
              <div className="flex h-full items-center justify-center">
                <div className="aspect-[9/16] w-3/4 rounded-md bg-gradient-to-b from-[oklch(0.4_0.08_295)] to-[oklch(0.22_0.03_285)] ring-1 ring-white/15" />
              </div>
            ) : layout.frame === 'split' ? (
              <div className="flex h-full flex-col gap-1">
                <div className="flex-1 rounded-md bg-gradient-to-br from-[oklch(0.42_0.08_300)] to-[oklch(0.22_0.03_285)]" />
                <div className="flex-1 rounded-md bg-gradient-to-br from-[oklch(0.4_0.08_200)] to-[oklch(0.22_0.03_220)]" />
              </div>
            ) : layout.frame === 'grid' ? (
              <div className="grid h-full grid-cols-2 grid-rows-2 gap-1">
                <div className="rounded-sm bg-[oklch(0.4_0.08_295)]" />
                <div className="rounded-sm bg-[oklch(0.38_0.08_200)]" />
                <div className="rounded-sm bg-[oklch(0.42_0.1_80)]" />
                <div className="rounded-sm bg-[oklch(0.36_0.08_350)]" />
              </div>
            ) : (
              <div className="flex h-full flex-col justify-end rounded-md bg-gradient-to-t from-[oklch(0.22_0.03_285)] to-[oklch(0.36_0.06_295)] p-1">
                <div className="h-1.5 rounded-full bg-white/30" />
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs font-medium text-foreground">{layout.id}</p>
        </div>
      ))}
    </div>
  )
}

export function EditorHeroMock() {
  return (
    <ProductFrame label="Transovo studio · Script + Timeline">
      <div className="bg-[oklch(0.16_0.008_285)]">
        <ScriptMock />
        <TimelineMock />
      </div>
    </ProductFrame>
  )
}

function ScriptMock() {
  const lines = [
    { mark: true, text: 'I think — wait, let me start over.' },
    { mark: false, text: 'The decision came down to three things.' },
    { mark: false, text: 'First, we needed a cut that still made sense.' },
    { mark: true, text: 'Um, yeah, so anyway…' },
    { mark: false, text: 'Then we tightened the silence between answers.' },
    { mark: false, text: 'That’s the take we kept.' },
  ]
  return (
    <div className="border-b border-border p-3 sm:p-4" aria-hidden>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">Script</span>
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground">
          Filler + silence · Undo
        </span>
      </div>
      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.text}
            className={`rounded-md px-3 py-1.5 text-[0.8rem] leading-relaxed ${
              line.mark
                ? 'bg-destructive/10 text-muted-foreground line-through decoration-destructive/60'
                : 'bg-card text-foreground'
            }`}
          >
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Waveform({ bars = 36, className = '' }: { bars?: number; className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-x-1 inset-y-0.5 ${className}`} viewBox={`0 0 ${bars * 4} 20`} preserveAspectRatio="none">
      {Array.from({ length: bars }, (_, i) => {
        const h = 4 + ((i * 11 + 3) % 14)
        return <rect key={i} x={i * 4 + 1} y={(20 - h) / 2} width="2" height={h} fill="white" opacity="0.75" />
      })}
    </svg>
  )
}

function TimelineMock() {
  const ticks = ['0:00', '0:15', '0:30', '0:45', '1:00']
  const playhead = '38%'
  return (
    <div className="p-4 sm:p-5" aria-hidden>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">Timeline</span>
        <span className="flex items-center gap-2 font-mono text-[0.6rem] text-muted-foreground">
          <span className="grid size-4 place-items-center rounded-full bg-brand-gradient text-[0.5rem] text-brand-foreground">
            ▶
          </span>
          00:22:18
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-2.5">
        <div className="mb-1 flex justify-between pl-[3.5rem] font-mono text-[0.55rem] text-muted-foreground">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="relative space-y-1.5">
          <Lane name="V1" color="var(--lane-voice)">
            <Clip left="2%" width="28%" />
            <Clip left="34%" width="22%" />
            <Clip left="60%" width="36%" />
          </Lane>
          <Lane name="C1" color="var(--lane-caption)" short>
            <Clip left="2%" width="26%" />
            <Clip left="34%" width="20%" />
            <Clip left="62%" width="30%" />
          </Lane>
          <Lane name="B1" color="var(--lane-broll)" short>
            <Clip left="40%" width="16%" />
            <Clip left="72%" width="18%" />
          </Lane>
          <Lane name="T1" color="var(--lane-brand)" short>
            <Clip left="8%" width="14%" keys={[18, 55, 82]} />
            <Clip left="64%" width="12%" keys={[30, 70]} />
          </Lane>
          <Lane name="A1" color="var(--lane-record)" wave>
            <Clip left="2%" width="28%" wave />
            <Clip left="34%" width="58%" wave />
          </Lane>
          <div className="pointer-events-none absolute bottom-0 top-0 z-10" style={{ left: `calc(3.5rem + (100% - 3.5rem) * 0.38)` }}>
            <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-brand" />
            <div className="h-full w-px bg-brand" />
          </div>
        </div>
        <span className="sr-only">Playhead at {playhead}</span>
      </div>
    </div>
  )
}

function Lane({
  name,
  color,
  children,
  short,
  wave,
}: {
  name: string
  color: string
  children: ReactNode
  short?: boolean
  wave?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 font-mono text-[0.6rem] text-muted-foreground">{name}</span>
      <div className={`relative flex-1 overflow-hidden rounded-sm bg-muted/70 ${short ? 'h-5' : 'h-8'}`} style={{ ['--lane' as string]: color }}>
        {children}
      </div>
    </div>
  )
}

function Clip({
  left,
  width,
  keys,
  wave,
}: {
  left: string
  width: string
  keys?: number[]
  wave?: boolean
}) {
  return (
    <div
      className="absolute inset-y-0.5 overflow-hidden rounded-[3px] opacity-95"
      style={{ left, width, background: 'var(--lane)' }}
    >
      {wave ? <Waveform bars={28} /> : null}
      {keys?.map((k) => (
        <span
          key={k}
          className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white shadow-xs"
          style={{ left: `${k}%` }}
        />
      ))}
    </div>
  )
}

export function CaptionBrandMock() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-hidden>
      {[
        { style: 'Bold pop', sample: 'HERE’S THE POINT' },
        { style: 'Clean lower', sample: 'Here’s the point' },
        { style: 'Word highlight', sample: 'Here’s the point' },
      ].map((item) => (
        <div key={item.style} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex aspect-video items-end justify-center bg-gradient-to-br from-[oklch(0.28_0.05_295)] to-[oklch(0.16_0.01_285)] p-3">
            <span className="rounded-md bg-black/60 px-2 py-1 text-center text-xs font-bold tracking-wide text-white">
              {item.sample}
            </span>
          </div>
          <p className="px-3 py-2 text-xs font-medium text-foreground">{item.style}</p>
        </div>
      ))}
    </div>
  )
}
