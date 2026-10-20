'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader, Panel } from '@/components/app/page-primitives'
import {
  fetchAutoAttendantMenu,
  publishAutoAttendantMenu,
  saveAutoAttendantMenu,
} from '@/lib/phone-forwarding-api'

const DEFAULT_GREETING =
  'Thank you for calling. Press 1 for scheduling, press 2 for service, or press 0 to speak with someone.'

const DEFAULT_OPTIONS = [
  { digit: '1', label: 'Scheduling', actionType: 'forward_phone', actionConfigJson: { press1: true } },
  { digit: '2', label: 'Service', actionType: 'forward_phone', actionConfigJson: { press1: true } },
  { digit: '0', label: 'Operator', actionType: 'forward_phone', actionConfigJson: { press1: true } },
]

export function AutoAttendantEditor({ menuId }: { menuId: string }) {
  const [name, setName] = useState('')
  const [greeting, setGreeting] = useState(DEFAULT_GREETING)
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchAutoAttendantMenu(menuId)
      .then((m) => {
        setName(m.name)
        setGreeting(m.greetingText || DEFAULT_GREETING)
        setStatus(m.status)
        if (m.options?.length) {
          setOptions(
            m.options.map((o: { digit: string; label: string; actionType: string; actionConfigJson?: unknown }) => ({
              digit: o.digit,
              label: o.label,
              actionType: o.actionType,
              actionConfigJson: (o.actionConfigJson || {}) as Record<string, unknown>,
            })),
          )
        }
      })
      .catch(() => toast.error('Could not load menu'))
      .finally(() => setLoading(false))
  }, [menuId])

  const save = () => {
    void saveAutoAttendantMenu(menuId, {
      name,
      greetingText: greeting,
      greetingMode: 'tts',
      options,
    })
      .then(() => toast.success('Draft saved'))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Save failed'))
  }

  const publish = () => {
    void saveAutoAttendantMenu(menuId, { name, greetingText: greeting, options })
      .then(() => publishAutoAttendantMenu(menuId))
      .then(() => {
        setStatus('published')
        toast.success('Menu published')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Publish failed'))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading menu…</p>

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-8">
        <PageHeader
          title={name || 'Phone menu'}
          description="Configure what callers hear and where each option sends them."
          breadcrumbs={[
            { label: 'Auto Attendant', href: '/app/phone/auto-attendant' },
            { label: name || 'Edit' },
          ]}
          actions={
            <>
              <Button type="button" variant="outline" size="sm" onClick={save}>Save draft</Button>
              <Button type="button" size="sm" onClick={publish}>Activate / Publish</Button>
            </>
          }
        />

        <Panel title="General">
          <div className="flex flex-col gap-2">
            <Label htmlFor="menu-name">Menu name</Label>
            <Input id="menu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </Panel>

        <Panel title="Welcome greeting" description="This is what callers hear before choosing an option.">
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={5}
            className="min-h-[120px]"
          />
        </Panel>

        <Panel title="Keypad options" description="Choose what happens when callers press a number.">
          <ul className="flex flex-col gap-3">
            {options.map((o, i) => (
              <li key={o.digit} className="flex min-h-16 items-center gap-3 rounded-lg border p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-semibold">
                  {o.digit}
                </span>
                <div className="min-w-0 flex-1">
                  <Input
                    value={o.label}
                    onChange={(e) =>
                      setOptions((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                      )
                    }
                    aria-label={`Option ${o.digit} label`}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Forward to phone (configure destination after publish)</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <aside className="lg:col-span-4">
        <Panel title="Call flow preview" description="Generated from your draft.">
          <p className="text-sm text-muted-foreground">Status: {status}</p>
          <div className="mt-3 space-y-1 text-sm">
            <div>Business number</div>
            <div className="text-muted-foreground">↓ Welcome greeting</div>
            {options.map((o) => (
              <div key={o.digit} className="text-muted-foreground">
                {o.digit} → {o.label}
              </div>
            ))}
          </div>
          <Button type="button" variant="link" className="mt-4 px-0" asChild>
            <Link href="/app/phone/forwarding">Assign on Call Forwarding</Link>
          </Button>
        </Panel>
      </aside>
    </div>
  )
}
