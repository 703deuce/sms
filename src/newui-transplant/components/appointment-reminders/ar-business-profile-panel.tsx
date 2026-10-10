'use client'

import { Panel, Callout } from '@/newui-transplant/components/app/kit'
import { Input } from '@/newui-transplant/components/ui/input'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { KeyValueRow } from '@/newui-transplant/components/app/kit'

export type ArBusinessProfileFields = {
  businessDisplayName: string
  businessPhone: string
  businessAddress: string
  directionsUrl: string
  brandColor: string
  preparationInstructions: string
  logoUrl: string
}

type Props = {
  fields: ArBusinessProfileFields
  onChange: (patch: Partial<ArBusinessProfileFields>) => void
}

export function ArBusinessProfilePanel({ fields, onChange }: Props) {
  const mergePreview = [
    { key: '{business_name}', value: fields.businessDisplayName || '—', field: 'businessDisplayName' },
    { key: '{business_phone}', value: fields.businessPhone || '—', field: 'businessPhone' },
    { key: '{location}', value: fields.businessAddress || '—', field: 'businessAddress' },
    { key: '{directions_link}', value: fields.directionsUrl || '—', field: 'directionsUrl' },
  ]

  return (
    <div className="space-y-4">
      <Panel title="Business information" description="Used in reminder templates and customer-facing emails.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium">Business name</span>
            <Input
              className="h-10"
              value={fields.businessDisplayName}
              onChange={(e) => onChange({ businessDisplayName: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Business phone</span>
            <Input
              className="h-10"
              value={fields.businessPhone}
              onChange={(e) => onChange({ businessPhone: e.target.value })}
              autoComplete="tel"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Directions URL</span>
            <Input
              className="h-10"
              value={fields.directionsUrl}
              onChange={(e) => onChange({ directionsUrl: e.target.value })}
              placeholder="https://maps.google.com/…"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium">Address / location</span>
            <Textarea
              className="min-h-[72px]"
              value={fields.businessAddress}
              onChange={(e) => onChange({ businessAddress: e.target.value })}
              placeholder="Street, city, state"
            />
          </label>
        </div>
      </Panel>

      <Panel title="Reminder identity" description="Email branding and optional preparation copy.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Email brand color</span>
            <Input
              className="h-10"
              value={fields.brandColor}
              onChange={(e) => onChange({ brandColor: e.target.value })}
              placeholder="#2563eb"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Logo URL</span>
            <Input
              className="h-10"
              value={fields.logoUrl}
              onChange={(e) => onChange({ logoUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium">Preparation instructions</span>
            <Textarea
              className="min-h-[80px]"
              value={fields.preparationInstructions}
              onChange={(e) => onChange({ preparationInstructions: e.target.value })}
            />
          </label>
        </div>
      </Panel>

      <Panel title="Merge variable preview" description="Values saved here populate templates automatically.">
        <div className="divide-y rounded-lg border">
          {mergePreview.map((row) => (
            <KeyValueRow
              key={row.key}
              label={row.key}
              value={row.value === '—' ? 'Missing — add above' : row.value}
              tone={row.value === '—' ? 'warning' : 'neutral'}
            />
          ))}
        </div>
        {mergePreview.some((r) => r.value === '—') ? (
          <Callout tone="warning" title="Incomplete business profile" className="mt-3">
            Fill missing fields so customers see complete reminder messages.
          </Callout>
        ) : null}
      </Panel>
    </div>
  )
}
