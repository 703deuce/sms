import { FieldRow, Page, PageHeader, Panel, Rows, TextLink } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'
import type { AiRecoverySimplifiedField } from '@/lib/mctb/ai-recovery/simplified-fields'

export type MctbAiRecoveryWired = {
  enabled?: boolean
  senderLabel?: string
  businessName?: string
  services?: string
  serviceArea?: string
  hours?: string
  fields?: Record<AiRecoverySimplifiedField, boolean>
  bookingLinkEnabled?: boolean
  bookingLinkUrl?: string
  bookingLinkLabel?: string
  onEnabledChange?: (value: boolean) => void
  onFieldChange?: (key: AiRecoverySimplifiedField, value: boolean) => void
  onBookingLinkEnabledChange?: (value: boolean) => void
  onBookingLinkUrlChange?: (value: string) => void
  onBookingLinkLabelChange?: (value: string) => void
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
  const sender = wired?.senderLabel ?? (live ? '—' : BUSINESS.sender)
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
              description={`AI replies from your text-back sender ${sender}. Your team can take over any time from the Inbox.`}
            >
              <Switch
                checked={enabled}
                onCheckedChange={(v) => wired?.onEnabledChange?.(Boolean(v))}
                aria-label="Enable AI Recovery"
              />
            </FieldRow>
            <div className="mt-4 flex gap-4 border-t pt-4">
              <TextLink href="/mctb/conversations">Open Inbox</TextLink>
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

          <Panel title="Booking link">
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
          </Panel>
        </div>

        <Panel
          title="Business information"
          description="AI uses this to answer questions"
          action={<ButtonLink href="/voice/knowledge" variant="outline" size="sm">Edit</ButtonLink>}
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
