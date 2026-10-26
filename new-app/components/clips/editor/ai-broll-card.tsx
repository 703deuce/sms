'use client'

import { Button } from '@/components/ui/button'

export function AiBrollCard({
  prompt,
  durationS,
  resolution,
  atMs,
  costUsd,
  onChange,
  onGenerate,
  busy,
}: {
  prompt: string
  durationS: number
  resolution: '480p' | '720p'
  atMs: number
  costUsd: number
  onChange: (patch: { prompt?: string; durationS?: number; resolution?: '480p' | '720p' }) => void
  onGenerate: () => void
  busy?: boolean
}) {
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <textarea
        className="min-h-[72px] w-full rounded-md border border-border bg-background p-2 text-sm"
        value={prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">
          Duration
          <select
            className="ml-1 rounded border px-1"
            value={durationS}
            onChange={(e) => onChange({ durationS: Number(e.target.value) })}
          >
            {[3, 4, 5].map((d) => (
              <option key={d} value={d}>{d}s</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Resolution
          <select
            className="ml-1 rounded border px-1"
            value={resolution}
            onChange={(e) => onChange({ resolution: e.target.value as '480p' | '720p' })}
          >
            <option value="480p">480p</option>
            <option value="720p">720p</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground">@ {Math.floor(atMs / 1000)}s · ${costUsd.toFixed(2)}</span>
      </div>
      <Button size="sm" className="mt-2" disabled={busy} onClick={onGenerate}>
        {busy ? 'Generating…' : 'Generate'}
      </Button>
    </div>
  )
}
