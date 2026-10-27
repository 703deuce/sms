'use client'

import type { T2vDraftV1 } from '@/lib/t2v/types'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

const MOODS = ['Upbeat', 'Calm', 'Corporate', 'Cinematic', 'Inspiring', 'Playful', 'Dramatic', 'Lo-fi'] as const

export function T2vPanelMusic({
  doc,
  onChange,
}: {
  doc: T2vDraftV1
  onChange: (next: T2vDraftV1) => void
}) {
  const music = doc.music ?? { volume: 0.25, duck: true }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">Background music mixes at export; ducking lowers music under voiceover.</p>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${music.label === m ? 'border-primary bg-primary/10' : 'border-border'}`}
            onClick={() => onChange({ ...doc, music: { ...music, label: m } })}
          >
            {m}
          </button>
        ))}
      </div>
      <div>
        <Label>Volume ({Math.round(music.volume * 100)}%)</Label>
        <Slider
          className="mt-2"
          min={0}
          max={100}
          step={5}
          value={[Math.round(music.volume * 100)]}
          onValueChange={([v]) => onChange({ ...doc, music: { ...music, volume: v / 100 } })}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="t2v-duck">Duck under voice</Label>
        <Switch
          id="t2v-duck"
          checked={music.duck}
          onCheckedChange={(on) => onChange({ ...doc, music: { ...music, duck: on } })}
        />
      </div>
    </div>
  )
}
