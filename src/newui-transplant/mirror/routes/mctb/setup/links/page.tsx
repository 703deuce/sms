'use client'

import { Copy, Link2, Plus } from 'lucide-react'
import { FieldRow, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Switch } from '@/newui-transplant/components/ui/switch'

export type MctbSetupLinksWired = {
  defaultLinkUrl: string
  defaultLinkLabel?: string
  requestFormEnabled: boolean
  requestFormUrl: string
  onDefaultLinkChange?: (v: string) => void
  onRequestFormEnabledChange?: (v: boolean) => void
  onCopyRequestForm?: () => void
  onSave?: () => Promise<void>
}

const DEMO_LINKS = [
  { label: 'Book a service visit', url: 'book.northsideplumbing.com/service', clicks: 29, isDefault: true },
  { label: 'Water heater estimate', url: 'northsideplumbing.com/estimate', clicks: 8 },
  { label: 'Leave a review', url: 'g.page/northside-plumbing/review', clicks: 3 },
]

export function TransplantMctbSetupLinksPage({ wired }: { wired?: MctbSetupLinksWired }) {
  const links = wired?.defaultLinkUrl
    ? [
        {
          label: wired.defaultLinkLabel ?? 'Default link',
          url: wired.defaultLinkUrl.replace(/^https?:\/\//, ''),
          clicks: 0,
          isDefault: true,
        },
        ...DEMO_LINKS.filter((l) => !l.isDefault),
      ]
    : DEMO_LINKS

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Links & request form</h2>
      <Panel title="Booking & tracking links" action={<Button size="sm" variant="outline"><Plus /> Add link</Button>} bodyClassName="p-0">
        <ul className="divide-y">
          {links.map((l) => (
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
          <Switch
            checked={wired?.requestFormEnabled ?? true}
            onCheckedChange={(v) => wired?.onRequestFormEnabledChange?.(v)}
            aria-label="Enable request form"
          />
        </FieldRow>
        <div className="mt-4 flex gap-2 border-t pt-4">
          <Input
            readOnly
            aria-label="Request form URL"
            value={wired?.requestFormUrl ?? 'https://relay.link/northside/request'}
            className="font-mono text-xs"
          />
          <Button variant="outline" type="button" aria-label="Copy URL" onClick={() => wired?.onCopyRequestForm?.()}>
            <Copy />
          </Button>
        </div>
      </Panel>
    </div>
  )
}
