import type { Metadata } from 'next'
import { Copy, Link2, Plus } from 'lucide-react'
import { FieldRow, Panel, Pill } from '@/components/app/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export const metadata: Metadata = { title: 'Links' }

const LINKS = [
  { label: 'Book a service visit', url: 'book.northsideplumbing.com/service', clicks: 29, isDefault: true },
  { label: 'Water heater estimate', url: 'northsideplumbing.com/estimate', clicks: 8 },
  { label: 'Leave a review', url: 'g.page/northside-plumbing/review', clicks: 3 },
]

export default function LinksSetupPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Links & request form</h2>
      <Panel title="Booking & tracking links" action={<Button size="sm" variant="outline"><Plus /> Add link</Button>} bodyClassName="p-0">
        <ul className="divide-y">
          {LINKS.map((l) => (
            <li key={l.url} className="flex items-center gap-3 px-5 py-3">
              <Link2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {l.label} {l.isDefault ? <Pill tone="primary">Default</Pill> : null}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">{l.url}</p>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{l.clicks} clicks</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Public request form">
        <FieldRow label="Enable request form" description="Customers can describe what they need from a link in your text">
          <Switch defaultChecked aria-label="Enable request form" />
        </FieldRow>
        <div className="mt-4 flex gap-2 border-t pt-4">
          <Input readOnly aria-label="Request form URL" value="https://relay.link/northside/request" className="font-mono text-xs" />
          <Button variant="outline" aria-label="Copy URL"><Copy /></Button>
        </div>
      </Panel>
    </div>
  )
}
