import { FieldRow, Page, PageHeader, Panel, Rows, TextLink } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'
import type { AiRecoverySimplifiedField } from '@/lib/mctb/ai-recovery/simplified-fields'
import { formatAiRecoverySenderDescription } from '@/lib/mctb/ai-recovery/sender-copy'

export type MctbAiRecoveryWired = {
  enabled?: boolean
  senderLabel?: string
  senderE164?: string | null
  businessName?: string
  services?: string
  serviceArea?: string
  hours?: string
  fields?: Record<AiRecoverySimplifiedField, boolean>
  bookingLinkEnabled?: boolean
  bookingLinkUrl?: string
  bookingLinkLabel?: string
  bookingLinkReadOnly?: boolean
  bookingLinkEditHref?: string
  onEnabledChange?: (value: boolean) => void
  onFieldChange?: (key: AiRecoverySimplifiedField, value: boolean) => void
  onBookingLinkEnabledChange?: (value: boolean) => void
  onBookingLinkUrlChange?: (value: string) => void
  onBookingLinkLabelChange?: (value: string) => void
  scenarios?: Array<{
    key: string
    title: string
    description: string
    enabled: boolean
    onChange: (value: boolean) => void
  }>
  onSave?: () => Promise<void>
}

const COLLECT: Array<{
  key: AiRecoverySimplifiedField
  label: string
  description: string
  defaultOn: boolean
}> = [
  { key: 'NAME', label: 'Name', description: 'Ask for the caller’s name', defaultOn: true },
  { key: 'REASON', label: 'What they need', description: 'Service or reason for calling', defaultOn: true },
  { key: 'ADDRESS', label: 'Service location', description: 'Address or neighborhood', defaultOn: true },
  { key: 'URGENCY', label: 'Urgency', description: 'Is this an emergency?', defaultOn: true },
  { key: 'CALLBACK_TIME', label: 'Best time to call back', description: 'Preferred callback window', defaultOn: false },
]

export function TransplantMctbAiRecoveryPage({ wired }: { wired?: MctbAiRecoveryWired }) {
  const live = wired !== undefined
  const senderDescription = formatAiRecoverySenderDescription(
    wired?.senderLabel ?? (live ? null : BUSINESS.sender),
    wired?.senderE164,
  )
  const enabled = wired?.enabled ?? (live ? false : true)
  const fields = wired?.fields
  const bookingOn = wired?.bookingLinkEnabled ?? (live ? false : true)
  const bookingUrl = wired?.bookingLinkUrl ?? (live ? '' : 'https://book.northsideplumbing.com/service')
  const bookingLabel = wired?.bookingLinkLabel ?? (live ? '' : 'Book a service visit')

  return (
    <Page>
      <PageHeader
        title="AI Recovery"
        description="Let AI continue the text conversation after a missed call, collect details, and share your booking link."
        actions={<SaveBar onSave={wired?.onSave} />}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel>
            <FieldRow
              label="AI Recovery"
              description={senderDescription}
            >
              <Switch
                checked={enabled}
                onCheckedChange={(v) => wired?.onEnabledChange?.(Boolean(v))}
                aria-label="Enable AI Recovery"
              />
            </FieldRow>
            <div className="mt-4 flex gap-4 border-t pt-4">
              <TextLink href="/mctb/conversations">Open conversations</TextLink>
              <TextLink href="/mctb/missed-calls">View Missed Calls</TextLink>
            </div>
          </Panel>

          <Panel title="Information to collect" description="AI asks only for what’s enabled, one question at a time">
            <div className="divide-y">
              {COLLECT.map((c) => (
                <FieldRow key={c.label} label={c.label} description={c.description}>
                  <Switch
                    checked={fields?.[c.key] ?? c.defaultOn}
                    onCheckedChange={(v) => wired?.onFieldChange?.(c.key, Boolean(v))}
                    aria-label={`Collect ${c.label}`}
                  />
                </FieldRow>
              ))}
            </div>
          </Panel>

          {wired?.scenarios?.length ? (
            <Panel title="Conversation scenarios" description="Which kinds of replies AI Recovery may handle">
              <ul className="divide-y">
                {wired.scenarios.map((s) => (
                  <li key={s.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.title}</span>
                      <span className="text-xs text-muted-foreground">{s.description}</span>
                    </span>
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={(v) => s.onChange(Boolean(v))}
                      aria-label={`Enable ${s.title}`}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Booking link">
            {wired?.bookingLinkReadOnly ? (
              <div className="space-y-3 text-sm">
                <FieldRow label="Share booking link" description="Uses the booking link configured in Text Back">
                  <Switch
                    checked={bookingOn}
                    onCheckedChange={(v) => wired?.onBookingLinkEnabledChange?.(Boolean(v))}
                    aria-label="Enable booking link for AI Recovery"
                    disabled={!bookingUrl}
                  />
                </FieldRow>
                {bookingUrl ? (
                  <>
                    <p className="font-medium">{bookingLabel || 'Book an appointment'}</p>
                    <p className="font-mono text-xs text-muted-foreground break-all">{bookingUrl}</p>
                    <p className="text-muted-foreground">AI can send this link when appropriate.</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No booking link configured.</p>
                )}
                <TextLink href={wired.bookingLinkEditHref || '/mctb/text-back?section=booking'}>
                  {bookingUrl ? 'Edit in Text Back' : 'Configure in Text Back'}
                </TextLink>
              </div>
            ) : (
              <>
                <FieldRow label="Share booking link" description="Sent once AI has collected the required details">
                  <Switch
                    checked={bookingOn}
                    onCheckedChange={(v) => wired?.onBookingLinkEnabledChange?.(Boolean(v))}
                    aria-label="Enable booking link"
                  />
                </FieldRow>
                <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="bl-url">Link URL</Label>
                    <Input
                      id="bl-url"
                      value={bookingUrl}
                      onChange={(e) => wired?.onBookingLinkUrlChange?.(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="bl-label">Label</Label>
                    <Input
                      id="bl-label"
                      value={bookingLabel}
                      onChange={(e) => wired?.onBookingLinkLabelChange?.(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </Panel>
        </div>

        <Panel
          title="Business information"
          description="AI uses this to answer questions"
          action={<ButtonLink href="/settings/business" variant="outline" size="sm">Edit</ButtonLink>}
          className="h-fit"
        >
          <Rows
            items={[
              { label: 'Name', value: <span className="truncate">{wired?.businessName ?? (wired ? '—' : 'Northside Plumbing')}</span> },
              { label: 'Services', value: wired?.services ?? (wired ? '—' : 'Plumbing, HVAC') },
              { label: 'Service area', value: wired?.serviceArea ?? (wired ? '—' : 'Greater Austin') },
              { label: 'Hours', value: wired?.hours ?? (wired ? '—' : 'Mon–Sat') },
            ]}
          />
        </Panel>
      </div>
    </Page>
  )
}
