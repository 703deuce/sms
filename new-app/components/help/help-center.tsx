'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bot, ExternalLink, LifeBuoy, MessageSquareReply, Phone } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { SearchInput, SimpleSelect } from '@/components/app/filters'

const START = [
  { title: 'Phone System', icon: Phone, href: '/app/numbers', body: 'Add or port a number, set business hours, and place a test call.' },
  { title: 'AI Receptionist', icon: Bot, href: '/app/receptionist/agent', body: 'Choose a voice, add your FAQs, then decide when the AI answers.' },
  { title: 'Missed Call Text Back', icon: MessageSquareReply, href: '/app/mctb/recovery', body: 'Turn on press-1 consent and write your first text-back message.' },
]

const FAQ = [
  { q: 'Why does my test call go straight to voicemail?', a: 'Check that forwarding is active on your carrier and that the line is inside business hours. Open Phone → Numbers and run "Verify forwarding".' },
  { q: 'Will the AI and text-back both respond to the same call?', a: 'No. Each call follows one routing policy. Text-back only fires when no human or AI answered.' },
  { q: 'How do callers opt out of texts?', a: 'Replying STOP opts them out instantly. Opted-out contacts are badged and replies are disabled.' },
  { q: 'Can the AI book directly into my calendar?', a: 'Yes, once a calendar integration is connected. Without one, the AI takes a message and creates a callback.' },
  { q: 'Why is a caller shown as "unresolved"?', a: 'The source number was withheld or could not be matched to a contact. You can link it manually from the call detail.' },
]

const CARRIERS: Record<string, string> = {
  att: 'Dial *21* followed by your Transovo number, then #. To cancel, dial #21#.',
  verizon: 'Dial *72 followed by your Transovo number. To cancel, dial *73.',
  tmobile: 'Dial **21* followed by your Transovo number, then #. To cancel, dial ##21#.',
  comcast: 'Open Business VoiceEdge → Call Forwarding → Always, and enter your Transovo number.',
  ringcentral: 'Admin Portal → Users → Call Handling → Forward all calls to your Transovo number.',
}

export function HelpCenter() {
  const [query, setQuery] = useState('')
  const [carrier, setCarrier] = useState('att')
  const faqs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? FAQ.filter((f) => (f.q + f.a).toLowerCase().includes(q)) : FAQ
  }, [query])

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Get started" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {START.map((s) => (
          <Link key={s.title} href={s.href} className="group flex flex-col gap-3 rounded-xl surface p-5 hover:border-primary/50">
            <s.icon className="size-5 text-primary" />
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
            <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
              Start setup
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Setup FAQs" className="lg:col-span-2" actions={<SearchInput value={query} onChange={setQuery} placeholder="Search FAQs…" />}>
          {faqs.length ? (
            <div className="flex flex-col divide-y">
              {faqs.map((f) => (
                <details key={f.q} className="group py-3 first:pt-0">
                  <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">{f.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No FAQs match &ldquo;{query}&rdquo;.</p>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Forwarding by carrier">
            <div className="flex flex-col gap-3">
              <SimpleSelect
                label="Carrier"
                value={carrier}
                onChange={setCarrier}
                options={[
                  { value: 'att', label: 'AT&T' },
                  { value: 'verizon', label: 'Verizon' },
                  { value: 'tmobile', label: 'T-Mobile' },
                  { value: 'comcast', label: 'Comcast Business' },
                  { value: 'ringcentral', label: 'RingCentral' },
                ]}
              />
              <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{CARRIERS[carrier]}</p>
              <Link href="/app/numbers" className="text-sm font-medium text-primary hover:underline">
                Verify forwarding on your numbers
              </Link>
            </div>
          </Panel>
          <Panel title="Still stuck?">
            <div className="flex flex-col gap-2">
              <a href="mailto:support@transovo.com" className={buttonVariants({ className: 'w-full' })}>
                <LifeBuoy />
                Contact support
              </a>
              <a href="https://status.transovo.com" target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
                System status
                <ExternalLink />
              </a>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
