'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Delete, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { useNumbers } from '@/components/providers/numbers-provider'
import { fetchCalls, searchContactsApi } from '@/lib/phone-api'
import { mapPhoneCallDtoToCall } from '@/lib/phone-ui-map'
import type { Call } from '@/lib/data'
import { formatPhone, formatWhen, initials } from '@/lib/format'

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
] as const

const toE164 = (raw: string) => {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

export function Dialer({ initialTo }: { initialTo?: string }) {
  const { startCall, activeCall } = useWorkspace()
  const { owned } = useNumbers()
  const callerIds = owned.filter((n) => n.status === 'active')
  const [value, setValue] = useState(initialTo ? formatPhone(initialTo) : '')
  const [callerId, setCallerId] = useState(callerIds[0]?.number ?? '')
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string; status: string }[]>([])
  const [recent, setRecent] = useState<Call[]>([])

  useEffect(() => {
    if (callerIds[0]?.number && !callerId) setCallerId(callerIds[0].number)
  }, [callerIds, callerId])

  useEffect(() => {
    void fetchCalls({ direction: 'outbound', limit: 6, page: 0 }).then((r) => setRecent(r.data.map(mapPhoneCallDtoToCall)))
  }, [])

  const e164 = toE164(value)
  const match = e164 ? suggestions.find((c) => c.phone === e164) : undefined
  const blocked = match?.status === 'BLOCKED'

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2 || e164) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => {
      void searchContactsApi(q).then(setSuggestions).catch(() => setSuggestions([]))
    }, 200)
    return () => clearTimeout(t)
  }, [value, e164])

  const call = (number: string, name: string) => {
    startCall({ name, number, callerId, source: 'dialer' })
  }

  const busy = !!activeCall && activeCall.status !== 'ended' && activeCall.status !== 'failed'

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr]">
      <Panel>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (e164 && !blocked) call(e164, match?.name ?? formatPhone(e164))
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="dial-input" className="sr-only">Number or contact name</label>
            <div className="relative">
              <Input
                id="dial-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Name or number"
                autoComplete="off"
                className="h-12 pr-10 text-center font-mono text-lg"
              />
              {value && (
                <button type="button" aria-label="Delete last digit" onClick={() => setValue((v) => v.slice(0, -1))} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <Delete className="size-4" />
                </button>
              )}
            </div>
            <p className="min-h-5 text-center text-xs text-muted-foreground" aria-live="polite">
              {blocked ? <span className="text-destructive">{match?.name} is blocked</span> : match ? match.name : e164 ? 'New number' : ''}
            </p>
            {suggestions.length > 0 && (
              <ul className="flex flex-col rounded-lg border">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setValue(formatPhone(c.phone))} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted">
                      <span>{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{formatPhone(c.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KEYS.map(([k, sub]) => (
              <button
                key={k}
                type="button"
                onClick={() => setValue((v) => v + k)}
                className="flex h-14 flex-col items-center justify-center rounded-xl bg-secondary text-lg font-medium transition-colors hover:bg-accent active:scale-95"
              >
                {k}
                <span className="text-[9px] tracking-widest text-muted-foreground">{sub}</span>
              </button>
            ))}
          </div>

          <SimpleSelect
            label="Call from"
            value={callerId}
            onChange={setCallerId}
            options={callerIds.map((n) => ({ value: n.number, label: `${n.nickname} · ${formatPhone(n.number)}` }))}
          />

          <Button type="submit" size="lg" className="h-12 bg-success text-success-foreground hover:bg-success/90" disabled={!e164 || blocked || busy}>
            <Phone />
            {busy ? 'On a call' : 'Call'}
          </Button>
        </form>
      </Panel>

      <Panel title="Recent outbound" bodyClassName="p-0">
        <ul className="divide-y">
          {recent.map((c) => {
            const name = c.caller || formatPhone(c.callerNumber)
            return (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">{initials(name)}</span>
                <Link href={`/app/phone/calls/${c.id}`} className="flex min-w-0 flex-1 flex-col hover:underline">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">{formatWhen(c.startedAt)}</span>
                </Link>
                <Button variant="ghost" size="icon-sm" aria-label={`Call ${name}`} disabled={busy} onClick={() => call(c.callerNumber, name)}>
                  <Phone />
                </Button>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}
