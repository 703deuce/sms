'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function formatInsertAt(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

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
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Duration</Label>
          <Select
            value={String(durationS)}
            onValueChange={(v) => typeof v === 'string' && onChange({ durationS: Number(v) })}
          >
            <SelectTrigger size="sm" className="w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5].map((d) => (
                <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Resolution</Label>
          <Select
            value={resolution}
            onValueChange={(v) => typeof v === 'string' && onChange({ resolution: v as '480p' | '720p' })}
          >
            <SelectTrigger size="sm" className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="480p">480p</SelectItem>
              <SelectItem value="720p">720p</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground">
          {durationS}s · {resolution} · about ${costUsd.toFixed(2)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Inserts at {formatInsertAt(atMs)}
      </p>
      <Button size="sm" className="mt-2" disabled={busy} onClick={onGenerate}>
        {busy ? 'Generating…' : 'Generate'}
      </Button>
    </div>
  )
}
