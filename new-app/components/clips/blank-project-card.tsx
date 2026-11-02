'use client'

/** G1b3: "Blank project" — open the editor on an empty canvas (no upload, no transcription, no credits). */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Square } from 'lucide-react'
import { createBlankProject } from '@/lib/clips-api'
import { cn } from '@/lib/utils'

const ASPECTS = [
  { id: '9:16', label: '9:16', hint: 'Shorts / Reels' },
  { id: '16:9', label: '16:9', hint: 'YouTube' },
  { id: '1:1', label: '1:1', hint: 'Square' },
  { id: '4:5', label: '4:5', hint: 'Feed' },
] as const

export function BlankProjectCard() {
  const router = useRouter()
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]['id']>('9:16')
  const [busy, setBusy] = useState(false)
  const start = async () => {
    setBusy(true)
    try {
      const p = await createBlankProject({ blank: { aspectRatio: aspect } })
      router.push(`/app/clips/${p.id}?open=editor`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the project')
      setBusy(false)
    }
  }
  return (
    <section className="mb-6 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center" data-testid="new-project-blank">
      <div className="flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-lg bg-muted">
          <Square className="size-5 text-primary" aria-hidden />
        </span>
        <div>
          <div className="text-sm font-semibold">Blank project</div>
          <div className="text-xs text-muted-foreground">Start from an empty canvas, then add media in the editor</div>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1 sm:justify-end" role="radiogroup" aria-label="Canvas aspect ratio">
        {ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={aspect === a.id}
            title={a.hint}
            onClick={() => setAspect(a.id)}
            className={cn('rounded-md border px-2 py-1 text-xs', aspect === a.id ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
            data-testid={`blank-aspect-${a.id}`}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="ml-1 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
          data-testid="blank-start"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Create
        </button>
      </div>
    </section>
  )
}
