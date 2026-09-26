'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import type { BusinessContext } from '@/newui-transplant/lib/view-models'

const COMPLIANCE = 'Northside Plumbing: Thanks for pressing 1! Msg & data rates may apply. Reply STOP to opt out, HELP for help.'
const VARIABLES = ['{first_name}', '{business_name}', '{booking_link}']

export function TextBackEditor({
  business,
  initialOpener = 'Hi! Sorry we missed your call at {business_name}. How can we help? You can also book here: {booking_link}',
}: {
  business: BusinessContext
  initialOpener?: string
}) {
  const [opener, setOpener] = useState(initialOpener)
  const ref = useRef<HTMLTextAreaElement>(null)
  const segments = Math.max(1, Math.ceil(opener.length / 160))

  const insert = (v: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? opener.length
    const end = el?.selectionEnd ?? opener.length
    setOpener(opener.slice(0, start) + v + opener.slice(end))
    requestAnimationFrame(() => el?.focus())
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">Consent mode:</span>
          <Link href="/mctb/setup/consent" className="font-medium text-primary hover:underline">Press 1</Link>
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <span className="text-muted-foreground">Sender:</span>
          <span className="font-mono text-xs">{business.sender}</span>
          <Pill tone="success">Ready</Pill>
        </div>

        <Panel title="System compliance message" description="Sent first. Required and can’t be edited.">
          <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {COMPLIANCE}
          </p>
        </Panel>

        <Panel title="Conversation opener" description="Sent right after the compliance message">
          <label htmlFor="opener" className="sr-only">Conversation opener</label>
          <Textarea id="opener" ref={ref} rows={4} value={opener} onChange={(e) => setOpener(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {VARIABLES.map((v) => (
              <Button key={v} size="xs" variant="outline" onClick={() => insert(v)} className="font-mono">
                {v}
              </Button>
            ))}
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {opener.length} chars · {segments} segment{segments > 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-4 flex justify-end"><SaveBar /></div>
        </Panel>
      </div>

      <aside aria-label="Message preview" className="rounded-[2rem] border-8 border-foreground/90 bg-card p-4 shadow-lg lg:sticky lg:top-20 lg:h-fit">
        <p className="mb-4 text-center text-xs text-muted-foreground">{business.sender}</p>
        <div className="flex flex-col gap-2">
          <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs leading-relaxed">{COMPLIANCE}</p>
          <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs leading-relaxed">
            {opener
              .replaceAll('{business_name}', 'Northside Plumbing')
              .replaceAll('{first_name}', 'Rachel')
              .replaceAll('{booking_link}', 'nsph.co/book')}
          </p>
        </div>
      </aside>
    </div>
  )
}
