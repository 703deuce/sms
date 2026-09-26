import { CalendarCheck, Check, MessageSquareText, PhoneForwarded, ShieldCheck, UserRoundSearch, Voicemail } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'

export const metadata: Metadata = { title: 'Receptionist' }

const CAPABILITIES = [
  { icon: CalendarCheck, label: 'Book appointments', detail: 'Google Calendar · Service team' },
  { icon: UserRoundSearch, label: 'Qualify leads', detail: 'Collects name, need, address, urgency' },
  { icon: PhoneForwarded, label: 'Transfer calls', detail: '3 transfer targets, emergency routing on' },
  { icon: MessageSquareText, label: 'Take messages', detail: 'Emailed to office@ and texted to on-call' },
  { icon: Voicemail, label: 'Voicemail fallback', detail: 'After 2 failed transfer attempts' },
  { icon: ShieldCheck, label: 'Spam protection', detail: 'Blocks known robocallers & solicitors' },
]

export function TransplantVoiceReceptionistPage() {
  return (
    <Page>
      <PageHeader
        title="Receptionist"
        description="A summary of how your AI receptionist greets and helps callers."
        actions={
          <>
            <ButtonLink href="/voice/receptionist" variant="outline">Continue setup</ButtonLink>
            <ButtonLink href="/voice/receptionist">Open setup editor</ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Status" className="lg:col-span-1">
          <div className="mb-5 flex flex-col items-center rounded-lg bg-accent/60 p-5 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              A
            </span>
            <p className="mt-3 text-base font-semibold">Ava</p>
            <p className="text-xs text-muted-foreground">Warm · American English</p>
          </div>
          <Rows
            items={[
              { label: 'Publish status', value: <Pill tone="success">Published</Pill> },
              { label: 'Version', value: 'v14 · Sep 22' },
              { label: 'Language', value: 'English, Spanish' },
              { label: 'Speaking speed', value: '1.0×' },
            ]}
          />
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Greeting" description="The first thing callers hear">
            <blockquote className="rounded-lg border-l-2 border-primary bg-muted/50 px-4 py-3 text-pretty text-sm leading-relaxed">
              {'"Thanks for calling Northside Plumbing & Heating, this is Ava. How can I help today?"'}
            </blockquote>
            <p className="mt-3 text-xs text-muted-foreground">
              After hours, Ava adds: {'"Our office is closed, but I can still book a visit or connect you with our on-call tech for emergencies."'}
            </p>
          </Panel>
          <Panel title="Capabilities" description="6 of 6 enabled">
            <ul className="grid gap-3 sm:grid-cols-2">
              {CAPABILITIES.map((cap) => (
                <li key={cap.label} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <cap.icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {cap.label} <Check className="size-3.5 text-success" aria-label="Enabled" />
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{cap.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
