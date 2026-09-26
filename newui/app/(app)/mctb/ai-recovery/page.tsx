import type { Metadata } from 'next'
import { FieldRow, Page, PageHeader, Panel, Rows, TextLink } from '@/components/app/kit'
import { ButtonLink } from '@/components/app/button-link'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SaveBar } from '@/components/app/save-bar'
import { BUSINESS } from '@/lib/data'

export const metadata: Metadata = { title: 'AI Recovery' }

const COLLECT = [
  { label: 'Name', description: 'Ask for the caller’s name', on: true },
  { label: 'What they need', description: 'Service or reason for calling', on: true },
  { label: 'Service location', description: 'Address or neighborhood', on: true },
  { label: 'Urgency', description: 'Is this an emergency?', on: true },
  { label: 'Best time to call back', description: 'Preferred callback window', on: false },
]

export default function AiRecoveryPage() {
  return (
    <Page>
      <PageHeader
        title="AI Recovery"
        description="Let AI continue the text conversation after a missed call, collect details, and share your booking link."
        actions={<SaveBar />}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel>
            <FieldRow
              label="AI Recovery"
              description={`AI replies from your text-back sender ${BUSINESS.sender}. Your team can take over any time from the Inbox.`}
            >
              <Switch defaultChecked aria-label="Enable AI Recovery" />
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
                  <Switch defaultChecked={c.on} aria-label={`Collect ${c.label}`} />
                </FieldRow>
              ))}
            </div>
          </Panel>

          <Panel title="Booking link">
            <FieldRow label="Share booking link" description="Sent once AI has collected the required details">
              <Switch defaultChecked aria-label="Enable booking link" />
            </FieldRow>
            <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="bl-url">Link URL</Label>
                <Input id="bl-url" defaultValue="https://book.northsideplumbing.com/service" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bl-label">Label</Label>
                <Input id="bl-label" defaultValue="Book a service visit" />
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
              { label: 'Name', value: <span className="truncate">Northside Plumbing</span> },
              { label: 'Services', value: 'Plumbing, HVAC' },
              { label: 'Service area', value: 'Greater Austin' },
              { label: 'Hours', value: 'Mon–Sat' },
            ]}
          />
        </Panel>
      </div>
    </Page>
  )
}
