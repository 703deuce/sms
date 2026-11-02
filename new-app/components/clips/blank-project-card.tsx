'use client'

/** G1b3: "Blank project" — open the editor on an empty canvas (no upload, no transcription, no credits). */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Square } from 'lucide-react'
import { createBlankProject } from '@/lib/clips-api'
import { OptionCard } from '@/components/app/option-card'
import { Segmented } from '@/components/app/segmented'
import { PrimaryButton } from '@/components/app/primary-button'

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
    <section className="mb-6 space-y-3" data-testid="new-project-blank">
      <OptionCard
        selected={false}
        icon={Square}
        title="Blank project"
        hint="Start from an empty canvas, then add media in the editor"
        className="min-h-[72px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
        <Segmented
          size="sm"
          aria-label="Canvas aspect ratio"
          items={ASPECTS.map((a) => ({ id: a.id, label: a.label }))}
          value={aspect}
          onChange={(id) => setAspect(id as (typeof ASPECTS)[number]['id'])}
        />
        <PrimaryButton size="sm" disabled={busy} onClick={() => void start()} data-testid="blank-start">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Create
        </PrimaryButton>
      </div>
    </section>
  )
}
