'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, Panel } from '@/components/app/page-primitives'
import { AutoAttendantGreetingSection } from '@/components/phone/auto-attendant-greeting-section'
import {
  AutoAttendantOptionDrawer,
  type MenuOptionDraft,
} from '@/components/phone/auto-attendant-option-drawer'
import {
  fetchAutoAttendantMenu,
  fetchAutoAttendantMenus,
  fetchCallForwarding,
  publishAutoAttendantMenu,
  saveAutoAttendantMenu,
} from '@/lib/phone-forwarding-api'

const DEFAULT_GREETING =
  'Thank you for calling. Press 1 for scheduling, press 2 for service, or press 0 to speak with someone.'

const DEFAULT_OPTIONS: MenuOptionDraft[] = [
  { digit: '1', label: 'Scheduling', actionType: 'forward_phone', actionConfigJson: { press1: true } },
  { digit: '2', label: 'Service', actionType: 'forward_phone', actionConfigJson: { press1: true } },
  { digit: '0', label: 'Operator', actionType: 'forward_phone', actionConfigJson: { press1: true } },
]

export function AutoAttendantEditor({ menuId }: { menuId: string }) {
  const [name, setName] = useState('')
  const [greeting, setGreeting] = useState(DEFAULT_GREETING)
  const [greetingMode, setGreetingMode] = useState<'tts' | 'audio'>('tts')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [options, setOptions] = useState<MenuOptionDraft[]>(DEFAULT_OPTIONS)
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(true)
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null)
  const [destinations, setDestinations] = useState<Array<{ id: string; name: string; phoneE164: string }>>([])
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [menus, setMenus] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    void Promise.all([
      fetchAutoAttendantMenu(menuId),
      fetchCallForwarding(),
      fetchAutoAttendantMenus(),
    ])
      .then(([m, fwd, allMenus]) => {
        setName(m.name)
        setGreeting(m.greetingText || DEFAULT_GREETING)
        setGreetingMode((m as { greetingMode?: string }).greetingMode === 'audio' ? 'audio' : 'tts')
        setAudioUrl((m as { greetingAudioUrl?: string }).greetingAudioUrl || null)
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
        setDestinations(fwd.destinations)
        setGroups(fwd.groups.map((g) => ({ id: g.id, name: g.name })))
        setMenus(allMenus.map((x) => ({ id: x.id, name: x.name })))
      })
      .catch(() => toast.error('Could not load menu'))
      .finally(() => setLoading(false))
  }, [menuId])

  const payload = useMemo(
    () => ({
      name,
      greetingText: greetingMode === 'tts' ? greeting : null,
      greetingMode,
      greetingAudioUrl: greetingMode === 'audio' ? audioUrl : null,
      options,
    }),
    [name, greeting, greetingMode, audioUrl, options],
  )

  const save = () => {
    void saveAutoAttendantMenu(menuId, payload)
      .then(() => toast.success('Draft saved'))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Save failed'))
  }

  const publish = () => {
    void saveAutoAttendantMenu(menuId, payload)
      .then(() => publishAutoAttendantMenu(menuId))
      .then(() => {
        setStatus('published')
        toast.success('Menu published')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Publish failed'))
  }

  const addOption = () => {
    const used = new Set(options.map((o) => o.digit))
    const digit = '0123456789'.split('').find((d) => !used.has(d)) || '9'
    setOptions([...options, { digit, label: 'New option', actionType: 'forward_phone', actionConfigJson: { press1: true } }])
    setDrawerIndex(options.length)
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

        <AutoAttendantGreetingSection
          menuId={menuId}
          greeting={greeting}
          greetingMode={greetingMode}
          audioUrl={audioUrl}
          onGreetingChange={(t) => {
            setGreetingMode('tts')
            setGreeting(t)
          }}
          onAudioUploaded={(url) => {
            setGreetingMode('audio')
            setAudioUrl(url)
          }}
        />

        <Panel title="Keypad options" description="Choose what happens when callers press a number.">
          <Button type="button" size="sm" variant="outline" className="mb-3" onClick={addOption}>
            <Plus className="size-4" />
            Add option
          </Button>
          <ul className="flex flex-col gap-3">
            {options.map((o, i) => (
              <li key={`${o.digit}-${i}`} className="flex min-h-16 items-center gap-3 rounded-lg border p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-semibold">
                  {o.digit}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.actionType.replace(/_/g, ' ')}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDrawerIndex(i)}>Edit</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
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

      <AutoAttendantOptionDrawer
        open={drawerIndex !== null}
        option={drawerIndex !== null ? options[drawerIndex] : null}
        destinations={destinations}
        groups={groups}
        menus={menus.filter((m) => m.id !== menuId)}
        onClose={() => setDrawerIndex(null)}
        onSave={(opt) => {
          if (drawerIndex === null) return
          setOptions((rows) => rows.map((r, j) => (j === drawerIndex ? opt : r)))
        }}
      />
    </div>
  )
}
