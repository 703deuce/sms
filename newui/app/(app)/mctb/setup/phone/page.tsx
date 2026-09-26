import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Panel, Pill, Rows } from '@/components/app/kit'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SaveBar } from '@/components/app/save-bar'
import { BUSINESS } from '@/lib/data'

export const metadata: Metadata = { title: 'Phone & Forwarding' }

const CARRIERS = ['Verizon', 'AT&T', 'T-Mobile', 'Comcast Business', 'RingCentral', 'Other']
const RING = ['10', '15', '20', '25', '30']

export default function PhoneSetupPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Business line" description="The public number customers call">
        <p className="font-mono text-lg font-semibold">{BUSINESS.line}</p>
        <p className="mt-1 text-xs text-muted-foreground">Main line · Verizon Business</p>
      </Panel>
      <Panel title="Forwarding destination" description="Unanswered calls forward here">
        <p className="font-mono text-lg font-semibold">(512) 555-0188</p>
        <p className="mt-1 text-xs text-muted-foreground">Managed by Relay · do not share publicly</p>
      </Panel>

      <Panel title="Carrier & ring timing">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium" id="carrier-label">Carrier</span>
            <Select defaultValue="Verizon" items={CARRIERS.map((c) => ({ label: c, value: c }))}>
              <SelectTrigger aria-labelledby="carrier-label" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium" id="ring-label">Ring before forwarding</span>
            <Select defaultValue="20" items={RING.map((r) => ({ label: `${r} seconds`, value: r }))}>
              <SelectTrigger aria-labelledby="ring-label" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RING.map((r) => <SelectItem key={r} value={r}>{r} seconds</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end"><SaveBar /></div>
      </Panel>

      <Panel title="Forwarding instructions" description="Verizon · conditional call forwarding">
        <ol className="flex flex-col gap-3 text-sm">
          {[
            'From your business phone, dial *71 followed by the forwarding number.',
            'Wait for the confirmation tone, then hang up.',
            'Place a test call and let it ring out.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{i + 1}</span>
              <span className="text-pretty">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-md bg-muted px-3 py-2 font-mono text-sm">*71 512 555 0188</p>
      </Panel>

      <Panel title="Verification" action={<Pill tone="success">Verified</Pill>}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium">Test call received</p>
            <p className="text-muted-foreground">Sep 24, 4:17 PM from (512) 555-0142 · forwarded after 20s</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-4">I&apos;ve turned it on — verify again</Button>
      </Panel>

      <Panel title="Text-back sender">
        <Rows
          items={[
            { label: 'Sender number', value: <span className="font-mono text-xs">{BUSINESS.sender}</span> },
            { label: 'Registration', value: <Pill tone="success">Registered (10DLC)</Pill> },
            { label: 'Throughput', value: '75 msg/min' },
          ]}
        />
      </Panel>
    </div>
  )
}
