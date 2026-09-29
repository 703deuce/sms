'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { Field, KeyValueRow, Panel, PageHeader, SettingRow } from '@/components/app/primitives'
import { SimpleSelect } from '@/components/app/simple-select'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { business } from '@/lib/data'
import { cn } from '@/lib/utils'

const fields = [
  { key: 'name', title: 'Name', description: 'Ask for the caller’s first and last name.' },
  { key: 'need', title: 'What they need', description: 'A short description of the job or question.' },
  { key: 'location', title: 'Service location', description: 'Street address or neighborhood.' },
  { key: 'urgency', title: 'Urgency', description: 'Emergency, this week, or flexible.' },
  { key: 'callback', title: 'Best time to call back', description: 'Preferred window for a teammate to follow up.' },
]

export function AiRecoveryForm() {
  const [enabled, setEnabled] = useState(true)
  const [booking, setBooking] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const touch = () => {
    setDirty(true)
    setSaved(false)
  }

  return (
    <>
      <PageHeader
        title="AI Recovery"
        description="Let AI continue the conversation after a missed-call text, gather details, and hand off to your team."
        actions={
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Check className="size-4 text-success" aria-hidden="true" /> Saved
              </span>
            )}
            <Button
              className="h-9"
              disabled={!dirty}
              onClick={() => {
                setDirty(false)
                setSaved(true)
              }}
            >
              Save changes
            </Button>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-xl border bg-sidebar p-6 text-sidebar-foreground">
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[oklch(0.6_0.2_280)] opacity-25 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary/25 text-[oklch(0.85_0.1_277)]">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <p className="font-semibold">AI Recovery</p>
            <p className="max-w-xl text-sm text-sidebar-foreground/70 text-pretty">
              Replies are sent from your registered business number. AI stops the moment a teammate replies in the{' '}
              <Link href="/mctb/conversations" className="underline underline-offset-4">Inbox</Link> or the customer opts out. See results on{' '}
              <Link href="/mctb/missed-calls" className="underline underline-offset-4">Missed Calls</Link>.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v)
              touch()
            }}
            aria-label="Enable AI Recovery"
          />
        </div>
      </section>

      <div className={cn('grid gap-6 lg:grid-cols-3', !enabled && 'pointer-events-none opacity-50')} aria-disabled={!enabled}>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="Information to collect" description="AI asks for these one at a time, in a natural tone.">
            <div className="divide-y">
              {fields.map((f) => (
                <SettingRow
                  key={f.key}
                  title={f.title}
                  description={f.description}
                  control={<Switch defaultChecked onCheckedChange={touch} aria-label={f.title} />}
                />
              ))}
            </div>
          </Panel>

          <Panel
            title="Booking link"
            description="Offer a link so customers can book themselves."
            action={
              <Switch
                checked={booking}
                onCheckedChange={(v) => {
                  setBooking(v)
                  touch()
                }}
                aria-label="Enable booking link"
              />
            }
          >
            <div className={cn('grid gap-4 sm:grid-cols-2', !booking && 'opacity-50')}>
              <Field label="Existing link" htmlFor="booking-link">
                <SimpleSelect
                  id="booking-link"
                  label="Existing link"
                  options={[
                    { value: 'book', label: 'brightline.link/book' },
                    { value: 'estimate', label: 'brightline.link/estimate' },
                    { value: 'new', label: 'Enter a new URL…' },
                  ]}
                  onChange={touch}
                />
              </Field>
              <Field label="Link label" htmlFor="booking-label" hint="Shown before the link in messages.">
                <Input id="booking-label" defaultValue="Book online" onChange={touch} className="h-9" />
              </Field>
            </div>
          </Panel>
        </div>

        <Panel
          title="Business information"
          description="What AI knows about you."
          action={
            <Link href="/settings/business" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Edit
            </Link>
          }
          bodyClassName="py-0 divide-y"
        >
          <KeyValueRow label="Name" value={business.name} />
          <KeyValueRow label="Services" value="Plumbing, HVAC" />
          <KeyValueRow label="Service area" value="Austin metro" />
          <KeyValueRow label="Hours" value="Mon–Sat, 7a–7p" />
        </Panel>
      </div>
    </>
  )
}
