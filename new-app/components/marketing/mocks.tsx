import { ProductFrame } from '@/components/marketing/product-frame'

export function ClipsHeroMock() {
  return (
    <ProductFrame label="Transovo Clips · Story review">
      <div className="grid gap-4 bg-[oklch(0.16_0.008_285)] p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex items-end justify-center gap-3 sm:gap-4">
          <ClipCard
            title="The setup"
            time="00:42"
            caption="So here’s what actually happened on set that week."
            why="Opens on a clear question, then lands the answer."
            layout="Speaker follow"
            offset="translate-y-4 hidden sm:block"
            dim
          />
          <ClipCard
            title="Story · 0:58"
            time="00:58"
            caption="We cut three days apart — and the argument still holds."
            why="Stitches the setup, the pushback, and the payoff."
            layout="9:16 · Story"
            featured
          />
          <ClipCard
            title="The payoff"
            time="00:31"
            caption="That’s the line I wish I had said in the moment."
            why="Clean ending on a complete sentence."
            layout="Split"
            offset="translate-y-4 hidden sm:block"
            dim
          />
        </div>
        <StoryStitchPanel />
      </div>
    </ProductFrame>
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
      className={`w-[9.5rem] shrink-0 sm:w-[10.5rem] ${offset ?? ''} ${dim ? 'opacity-70' : ''} ${featured ? 'z-10 scale-[1.04]' : ''}`}
      aria-hidden
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[oklch(0.28_0.05_295)] via-[oklch(0.2_0.02_285)] to-[oklch(0.14_0.01_285)] shadow-md">
        <div className="flex items-center justify-between px-2.5 pt-2.5">
          <span className="rounded-full bg-black/40 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-white/80">
            {layout}
          </span>
          <span className="font-mono text-[0.55rem] text-white/60">{time}</span>
        </div>
        <div className="mx-auto mt-6 size-16 rounded-full bg-gradient-to-br from-[oklch(0.72_0.12_80)] to-[oklch(0.45_0.08_40)] ring-2 ring-white/20" />
        <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-white/20" />
        <div className="absolute inset-x-0 bottom-0 mt-auto px-2 pb-2 pt-10">
          <p className="rounded-md bg-black/55 px-1.5 py-1 text-center text-[0.62rem] font-semibold leading-snug text-white">
            {caption}
          </p>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-border bg-card px-2 py-1.5">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-brand">Why this clip</p>
        <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">{why}</p>
        <p className="mt-1 truncate text-[0.7rem] font-medium text-foreground">{title}</p>
      </div>
    </div>
  )
}

function StoryStitchPanel() {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-border bg-card/70 p-4 sm:p-5" aria-hidden>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-brand">Story stitch</p>
      <p className="mt-1 text-sm font-medium text-foreground">Non-contiguous moments, one clip</p>
      <ol className="mt-4 space-y-3">
        {[
          { t: '02:14', label: 'Setup', body: 'The question that starts the thread.' },
          { t: '18:41', label: 'Turn', body: 'A later rebuttal, kept in context.' },
          { t: '41:07', label: 'Payoff', body: 'The line that closes the story.' },
        ].map((step, i) => (
          <li key={step.t} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span className="grid size-6 place-items-center rounded-full bg-brand-gradient text-[0.65rem] font-semibold text-brand-foreground">
                {i + 1}
              </span>
              {i < 2 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium text-foreground">
                {step.label}{' '}
                <span className="font-mono text-[0.65rem] text-muted-foreground">{step.t}</span>
              </p>
              <p className="text-xs text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
        <span className="text-xs text-muted-foreground">Target length</span>
        <span className="flex gap-1">
          {['30s', '60s', '90s'].map((d) => (
            <span
              key={d}
              className={`rounded-md px-2 py-0.5 font-mono text-[0.65rem] ${d === '60s' ? 'bg-brand-gradient text-brand-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {d}
            </span>
          ))}
        </span>
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
      <div className="grid bg-[oklch(0.16_0.008_285)] lg:grid-cols-2">
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
    <div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r" aria-hidden>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">Script</span>
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground">
          Filler + silence
        </span>
      </div>
      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.text}
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
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

function TimelineMock() {
  const lanes = [
    { name: 'Video', color: 'var(--lane-voice)', width: '92%' },
    { name: 'Captions', color: 'var(--lane-caption)', width: '70%' },
    { name: 'B-roll', color: 'var(--lane-broll)', width: '48%' },
    { name: 'Titles', color: 'var(--lane-brand)', width: '36%' },
    { name: 'Voice', color: 'var(--lane-record)', width: '80%' },
  ]
  return (
    <div className="p-4 sm:p-5" aria-hidden>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">Timeline</span>
        <span className="font-mono text-[0.6rem] text-muted-foreground">Snap · Trim · Keyframes</span>
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-panel p-3">
        {lanes.map((lane) => (
          <div key={lane.name} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[0.65rem] text-muted-foreground">{lane.name}</span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
              <div
                className="absolute inset-y-1 left-1 rounded-sm opacity-90"
                style={{ width: lane.width, background: lane.color }}
              />
              {lane.name === 'Voice' ? (
                <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 200 24" preserveAspectRatio="none">
                  {Array.from({ length: 40 }, (_, i) => {
                    const h = 4 + ((i * 7) % 16)
                    return <rect key={i} x={i * 5 + 2} y={(24 - h) / 2} width="2" height={h} fill="white" opacity="0.7" />
                  })}
                </svg>
              ) : null}
            </div>
          </div>
        ))}
        <div className="relative h-4">
          <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          <div className="absolute left-[38%] top-0 h-4 w-px bg-brand" />
          <div className="absolute left-[38%] -top-0.5 size-2 -translate-x-1/2 rounded-full bg-brand" />
        </div>
      </div>
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
