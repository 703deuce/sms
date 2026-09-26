'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, MoreHorizontal, Phone, PhoneMissed, Search, X } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/newui-transplant/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { EmptyState, Initials } from '@/newui-transplant/components/app/kit'
import { RecoveryPill } from '@/newui-transplant/components/app/status'
import type { MctbMissedCallsListWiring } from '@/newui-transplant/mirror/routes/mctb/missed-calls/page'
import type { MissedCall } from '@/newui-transplant/lib/view-models'

const opts = (values: string[]) => values.map((v) => ({ label: v, value: v }))
const RECOVERY = opts(['All', 'Needs attention', 'Replied', 'Waiting for consent', 'Suppressed', 'Failed'])
const DATES = opts(['Today', 'Last 7 days', 'Last 30 days', 'All time'])
const TRIGGERS = opts(['All', 'No answer', 'Busy', 'Rejected', 'Unreachable', 'Voicemail'])
const SORTS = opts(['Newest first', 'Oldest first'])

function FilterSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  items: { label: string; value: string }[]
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as string)} items={items}>
      <SelectTrigger aria-label={label} className="min-w-32">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function MissedCallsBrowser({
  missedCalls,
  wiring,
}: {
  missedCalls: MissedCall[]
  wiring?: MctbMissedCallsListWiring
}) {
  const [queryLocal, setQueryLocal] = useState('')
  const [recoveryLocal, setRecoveryLocal] = useState('All')
  const [dateLocal, setDateLocal] = useState('Last 7 days')
  const [triggerLocal, setTriggerLocal] = useState('All')
  const [sortLocal, setSortLocal] = useState('Newest first')

  const query = wiring?.query ?? queryLocal
  const setQuery = wiring?.onQueryChange ?? setQueryLocal
  const recovery = wiring?.recovery ?? recoveryLocal
  const setRecovery = wiring?.onRecoveryChange ?? setRecoveryLocal
  const date = wiring?.date ?? dateLocal
  const setDate = wiring?.onDateChange ?? setDateLocal
  const trigger = wiring?.trigger ?? triggerLocal
  const setTrigger = wiring?.onTriggerChange ?? setTriggerLocal
  const sort = wiring?.sort ?? sortLocal
  const setSort = wiring?.onSortChange ?? setSortLocal

  const rows = useMemo(() => {
    if (wiring) return missedCalls
    const q = query.trim().toLowerCase()
    const list = missedCalls.filter(
      (m) =>
        (recovery === 'All' || m.recovery === recovery) &&
        (trigger === 'All' || m.trigger === trigger) &&
        (!q || `${m.caller} ${m.phone}`.toLowerCase().includes(q)),
    )
    return sort === 'Oldest first' ? [...list].reverse() : list
  }, [query, recovery, trigger, sort, missedCalls, wiring])

  const dirty =
    query ||
    recovery !== 'All' ||
    date !== 'Last 7 days' ||
    trigger !== 'All' ||
    sort !== 'Newest first'

  const clear = () => {
    setQuery('')
    setRecovery('All')
    setDate('Last 7 days')
    setTrigger('All')
    setSort('Newest first')
    if (wiring) wiring.onPageChange(1)
  }

  const page = wiring?.page ?? 1
  const pageCount = wiring?.pageCount ?? 1
  const total = wiring?.total ?? missedCalls.length

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search caller or number"
            aria-label="Search caller or number"
            className="pl-8"
          />
        </div>
        <FilterSelect label="Recovery" value={recovery} onChange={setRecovery} items={RECOVERY} />
        <FilterSelect label="Date" value={date} onChange={setDate} items={DATES} />
        <FilterSelect label="Trigger" value={trigger} onChange={setTrigger} items={TRIGGERS} />
        <FilterSelect label="Sort" value={sort} onChange={setSort} items={SORTS} />
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X /> Clear filters
          </Button>
        ) : null}
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-medium">Caller</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Missed</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Trigger</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Recovery</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Reply</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Business line</th>
                <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <Link href={`/mctb/missed-calls/${m.id}`} className="flex items-center gap-3">
                      <Initials name={m.caller} />
                      <span className="min-w-0">
                        <span className="block font-medium hover:underline">{m.caller}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{m.phone}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{m.missed}</td>
                  <td className="px-3 py-3">{m.trigger}</td>
                  <td className="px-3 py-3"><RecoveryPill status={m.recovery} /></td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-muted-foreground">{m.reply ?? '—'}</td>
                  <td className="px-3 py-3 text-muted-foreground">{m.line}</td>
                  <td className="px-3 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.caller}`} />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/mctb/missed-calls/${m.id}`} />}>Open</DropdownMenuItem>
                        <DropdownMenuItem render={<a href={`tel:${m.phone}`} />}>
                          <Phone /> Call back
                        </DropdownMenuItem>
                        {m.conversationId ? (
                          <DropdownMenuItem render={<Link href={`/mctb/conversations?conversation=${m.conversationId}`} />}>
                            <MessageSquare /> Open conversation
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            const e164 = m.callerE164 || m.phone
                            void wiring?.onAddExclusion?.(e164, m.caller)
                          }}
                        >
                          Add to exclusions
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={PhoneMissed}
          title="No missed calls match"
          description="Adjust the filters or clear them to see all missed calls."
          action={<Button variant="outline" size="sm" onClick={clear}>Clear filters</Button>}
        />
      )}

      <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
        <span>
          {rows.length} of {total} · {date}
        </span>
        <span>
          Page {page} of {pageCount}
        </span>
      </div>
    </div>
  )
}
