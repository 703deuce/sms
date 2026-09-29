'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, MoreHorizontal, Phone, PhoneMissed, Search, X } from 'lucide-react'
import { Avatar, EmptyState, StatusPill } from '@/components/app/primitives'
import { SimpleSelect } from '@/components/app/simple-select'
import { td, th } from '@/components/app/tables'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { conversations, missedCalls, recoveryTone } from '@/lib/data'

const outcomeOptions = [
  { value: 'all', label: 'All outcomes' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'Replied', label: 'Replied' },
  { value: 'Waiting for consent', label: 'Waiting for consent' },
  { value: 'Suppressed', label: 'Suppressed' },
  { value: 'Failed', label: 'Failed' },
]
const dateOptions = [
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]
const triggerOptions = [
  { value: 'all', label: 'All triggers' },
  ...['No answer', 'Busy', 'Rejected', 'Unreachable', 'Voicemail'].map((t) => ({ value: t, label: t })),
]
const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

export function MissedCallsView() {
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [trigger, setTrigger] = useState('all')
  const [date, setDate] = useState('7')
  const [sort, setSort] = useState('newest')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = missedCalls.filter((m) => {
      if (q && !m.caller.toLowerCase().includes(q) && !m.number.includes(q)) return false
      if (trigger !== 'all' && m.trigger !== trigger) return false
      if (outcome === 'attention') return m.recovery === 'Needs reply' || m.recovery === 'Failed'
      if (outcome !== 'all' && m.recovery !== outcome) return false
      return true
    })
    return sort === 'oldest' ? [...filtered].reverse() : filtered
  }, [query, outcome, trigger, sort])

  const hasFilters = query || outcome !== 'all' || trigger !== 'all' || sort !== 'newest'

  return (
    <div className="rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,18,40,0.04)]">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="missed-search" className="sr-only">
            Search caller or number
          </label>
          <input
            id="missed-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search caller or number"
            className="h-9 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect label="Recovery outcome" options={outcomeOptions} value={outcome} onChange={setOutcome} className="w-44" />
          <SimpleSelect label="Date range" options={dateOptions} value={date} onChange={setDate} className="w-36" />
          <SimpleSelect label="Trigger" options={triggerOptions} value={trigger} onChange={setTrigger} className="w-36" />
          <SimpleSelect label="Sort" options={sortOptions} value={sort} onChange={setSort} className="w-36" />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('')
                setOutcome('all')
                setTrigger('all')
                setSort('newest')
              }}
            >
              <X aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={PhoneMissed} title="No missed calls match" description="Try clearing filters or widening the date range." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className={th}>Caller</th>
                <th className={th}>Missed</th>
                <th className={th}>Trigger</th>
                <th className={th}>Recovery</th>
                <th className={th}>Reply</th>
                <th className={th}>Business line</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => {
                const convo = conversations.find((c) => c.missedCallId === m.id)
                return (
                  <tr key={m.id} className="hover:bg-muted/40">
                    <td className={td}>
                      <Link href={`/mctb/missed-calls/${m.id}`} className="flex items-center gap-3">
                        <Avatar name={m.caller} />
                        <span className="flex flex-col">
                          <span className="font-medium">{m.caller}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{m.number}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={`${td} text-muted-foreground`}>{m.missed}</td>
                    <td className={td}>{m.trigger}</td>
                    <td className={td}>
                      <StatusPill tone={recoveryTone[m.recovery]}>{m.recovery}</StatusPill>
                    </td>
                    <td className={`${td} max-w-64 truncate text-muted-foreground`}>{m.reply ?? '—'}</td>
                    <td className={`${td} text-muted-foreground`}>{m.line}</td>
                    <td className={`${td} text-right`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.caller}`} />}>
                          <MoreHorizontal aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/mctb/missed-calls/${m.id}`} />}>Open</DropdownMenuItem>
                          <DropdownMenuItem render={<a href={`tel:${m.number}`} />}>
                            <Phone aria-hidden="true" /> Call back
                          </DropdownMenuItem>
                          {convo && (
                            <DropdownMenuItem render={<Link href={`/mctb/conversations?conversation=${convo.id}`} />}>
                              <MessageSquare aria-hidden="true" /> Open conversation
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Add to exclusions</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground tabular-nums">{rows.length}</span> of {missedCalls.length}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
