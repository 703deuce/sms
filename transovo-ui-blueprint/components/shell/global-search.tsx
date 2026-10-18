'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CALLS, CAMPAIGNS, CONTACTS, NUMBERS } from '@/lib/data'
import { formatPhone, formatWhen } from '@/lib/format'

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return null
    const digits = term.replace(/\D/g, '')
    const matchPhone = (p: string) => digits.length >= 3 && p.includes(digits)
    return {
      contacts: CONTACTS.filter((c) => c.name.toLowerCase().includes(term) || matchPhone(c.phone)).slice(0, 4),
      calls: CALLS.filter((c) => c.caller.toLowerCase().includes(term) || matchPhone(c.callerNumber)).slice(0, 3),
      numbers: NUMBERS.filter((n) => n.label.toLowerCase().includes(term) || matchPhone(n.number)).slice(0, 3),
      campaigns: CAMPAIGNS.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 3),
    }
  }, [q])

  const empty =
    results && !results.contacts.length && !results.calls.length && !results.numbers.length && !results.campaigns.length

  const close = () => {
    setOpen(false)
    setQ('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-44 sm:px-2.5 md:w-56 max-sm:justify-center">
            <Search />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] md:inline">/</kbd>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contacts, calls, numbers, campaigns"
            aria-label="Global search"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2 text-sm">
          {!results && <p className="px-2 py-6 text-center text-muted-foreground">Type a name or phone number.</p>}
          {empty && <p className="px-2 py-6 text-center text-muted-foreground">{`No matches for "${q}".`}</p>}
          {results && results.contacts.length > 0 && (
            <ResultGroup label="Contacts">
              {results.contacts.map((c) => (
                <ResultLink key={c.id} href={`/app/contacts/${c.id}`} onClick={close} title={c.name} meta={formatPhone(c.phone)} />
              ))}
            </ResultGroup>
          )}
          {results && results.calls.length > 0 && (
            <ResultGroup label="Calls">
              {results.calls.map((c) => (
                <ResultLink key={c.id} href={`/app/calls/${c.id}`} onClick={close} title={c.caller} meta={formatWhen(c.startedAt)} />
              ))}
            </ResultGroup>
          )}
          {results && results.numbers.length > 0 && (
            <ResultGroup label="Numbers">
              {results.numbers.map((n) => (
                <ResultLink key={n.id} href="/app/numbers" onClick={close} title={n.label} meta={formatPhone(n.number)} />
              ))}
            </ResultGroup>
          )}
          {results && results.campaigns.length > 0 && (
            <ResultGroup label="Campaigns">
              {results.campaigns.map((c) => (
                <ResultLink key={c.id} href="/app/phone/power-dialer?tab=campaigns" onClick={close} title={c.name} meta={c.status} />
              ))}
            </ResultGroup>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col pb-2">
      <p className="px-2 py-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  )
}

function ResultLink({ href, title, meta, onClick }: { href: string; title: string; meta: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
      <span className="truncate font-medium">{title}</span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{meta}</span>
    </Link>
  )
}
