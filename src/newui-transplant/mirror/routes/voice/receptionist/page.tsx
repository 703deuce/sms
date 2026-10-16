import { CalendarCheck, Check, MessageSquareText, PhoneForwarded, ShieldCheck, UserRoundSearch, Voicemail } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'

export type VoiceReceptionistCapabilityWired = {
  id: string
  label: string
  detail: string
  enabled: boolean
}

export type VoiceReceptionistWired = {
  agentId?: string
  agentInitial?: string
  agentName?: string
  voiceLabel?: string
  greeting?: string
  published?: boolean
  versionLabel?: string
  capabilities?: VoiceReceptionistCapabilityWired[]
  editHref?: string
}

const CAPABILITY_ICONS: Record<string, typeof CalendarCheck> = {
  book_appointments: CalendarCheck,
  qualify_callers: UserRoundSearch,
  transfer_calls: PhoneForwarded,
  take_messages: MessageSquareText,
  answer_questions: MessageSquareText,
  send_sms_confirmations: MessageSquareText,
  reschedule: CalendarCheck,
  cancel: CalendarCheck,
}

function capabilityIcon(id: string) {
  return CAPABILITY_ICONS[id] ?? ShieldCheck
}

export function TransplantVoiceReceptionistPage({ wired }: { wired?: VoiceReceptionistWired }) {
  const agentInitial = wired?.agentInitial ?? 'R'
  const agentName = wired?.agentName ?? 'Receptionist'
  const voiceLabel = wired?.voiceLabel ?? 'Not configured'
  const greeting = wired?.greeting ?? 'Configure an opening greeting in setup.'
  const published = wired?.published ?? false
  const versionLabel = wired?.versionLabel ?? 'Draft'
  const editHref = wired?.editHref ?? '/voice/receptionist/edit'
  const capabilities = wired?.capabilities?.filter((c) => c.enabled) ?? []
  const enabledCount = capabilities.length
  const totalCount = wired?.capabilities?.length ?? 0

  return (
    <Page>
      <PageHeader
        title="Receptionist"
        description="A summary of how your AI receptionist greets and helps callers."
        actions={
          <>
            <ButtonLink href={editHref} variant="outline">Continue setup</ButtonLink>
            <ButtonLink href={editHref}>Open setup editor</ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Status" className="lg:col-span-1">
          <div className="mb-5 flex flex-col items-center rounded-lg bg-accent/60 p-5 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {agentInitial}
            </span>
            <p className="mt-3 text-base font-semibold">{agentName}</p>
            <p className="text-xs text-muted-foreground">{voiceLabel}</p>
          </div>
          <Rows
            items={[
              { label: 'Publish status', value: <Pill tone={published ? 'success' : 'warning'}>{published ? 'Published' : 'Draft'}</Pill> },
              { label: 'Version', value: versionLabel },
            ]}
          />
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Greeting" description="The first thing callers hear">
            <blockquote className="rounded-lg border-l-2 border-primary bg-muted/50 px-4 py-3 text-pretty text-sm leading-relaxed">
              {`"${greeting}"`}
            </blockquote>
          </Panel>
          <Panel
            title="Capabilities"
            description={
              totalCount > 0
                ? `${enabledCount} of ${totalCount} enabled`
                : 'Finish setup to see enabled capabilities'
            }
          >
            {capabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No capabilities enabled yet. Open setup to choose what your receptionist can do.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {capabilities.map((cap) => {
                  const Icon = capabilityIcon(cap.id)
                  return (
                    <li key={cap.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          {cap.label} <Check className="size-3.5 text-success" aria-label="Enabled" />
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{cap.detail}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {capabilities.some((c) => c.id === 'transfer_calls') ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Transfer and voicemail behavior follow your call-handling settings in setup.
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </Page>
  )
}
