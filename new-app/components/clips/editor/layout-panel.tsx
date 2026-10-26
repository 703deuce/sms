'use client'

import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { CropShot } from '@/lib/server/clips/clip-detail'

const LAYOUTS: { id: ClipEditsV2['layout']['mode']; title: string; desc: string; disabled?: boolean }[] = [
  { id: 'speaker_follow', title: 'Speaker follow', desc: 'Track the active speaker.' },
  { id: 'fit_blur', title: 'Fit with blur', desc: 'Letterbox with blurred fill.' },
  { id: 'center_crop', title: 'Center crop', desc: 'Static center crop.' },
  { id: 'subject_follow', title: 'Subject follow', desc: 'ClipAnything — later', disabled: true },
]

export function LayoutPanel({
  edits,
  shots,
  onMode,
  onShotFocus,
  onRerunReframe,
}: {
  edits: ClipEditsV2
  shots: CropShot[]
  onMode: (mode: ClipEditsV2['layout']['mode']) => void
  onShotFocus: (i: number, focus: 'auto' | 'A' | 'B' | 'both') => void
  onRerunReframe: (shotIndex: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            disabled={l.disabled}
            onClick={() => onMode(l.id)}
            className={`rounded-lg border p-3 text-left ${
              edits.layout.mode === l.id ? 'border-primary ring-1 ring-primary' : 'border-border'
            } ${l.disabled ? 'opacity-50' : ''}`}
          >
            <p className="text-sm font-medium">{l.title}</p>
            <p className="text-xs text-muted-foreground">{l.desc}</p>
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {shots.map((shot, i) => {
          const focus =
            edits.layout.shotOverrides.find((s) => s.i === i)?.focus ?? 'auto'
          return (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium">
                  {(shot.startMs / 1000).toFixed(1)}s – {(shot.endMs / 1000).toFixed(1)}s (source)
                </p>
                <p className="text-xs text-muted-foreground">Auto speaker {shot.speaker}</p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                Focus on
                <select
                  className="rounded border border-border bg-background px-2 py-1"
                  value={focus}
                  onChange={(e) => onShotFocus(i, e.target.value as 'auto' | 'A' | 'B' | 'both')}
                >
                  <option value="auto">Auto</option>
                  <option value="A">Speaker A</option>
                  <option value="B">Speaker B</option>
                  <option value="both">Both-wide</option>
                </select>
              </label>
              <Button size="sm" variant="outline" onClick={() => onRerunReframe(i)}>Re-run auto reframe</Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
