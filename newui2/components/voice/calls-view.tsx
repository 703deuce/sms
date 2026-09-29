'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarCheck, ChevronLeft, ChevronRight, Clock, PhoneIncoming, Search, UserPlus } from 'lucide-react'
import { Panel, StatCard, EmptyState } from '@/components/app/primitives'
import { CallsTable } from '@/components/app/tables'
import { Segmented } from '@/components/app/tab-nav'
import { SimpleSelect } from '@/components/app/simple-select'
import { calls, type CallOutcome } from '@/lib/data'
import { cn } from '@/lib/utils'

const filters: { label: string; outcome?: CallOutcome }[] = [
  { label: 'All Calls' },
  { label: 'Leads', outcome: 'Lead' },
  { label: 'Appointments', outcome: 'Appointment' },
  { label: 'Messages', outcome: 'Message' },
  { label: 'Transfers', outcome: 'Transfer' },
  { label: 'Voicemails', outcome: 'Voicemail' },
  { label: 'No Answer', outcome: 'No answer' },
]

export function CallsView() {
  const [tab, setTab] = useState('All calls')
  const [filter, setFilter] = useState('All Calls')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const outcome = filters.find((f) => f.label === filter)?.outcome
    return calls.filter((c) => {
      if (tab === 'Needs attention' && !c.attention) return false
      if (tab === 'All calls' && outcome && c.outcome !== outcome) return false
      const q = query.toLowerCase()
      return !q || c.caller.toLowerCase().includes(q) || c.number.includes(q)
    })
  }, [tab, filter, query])

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Answered" value="284" delta={{ value: '+12%', positive: true }} icon={PhoneIncoming} />
        <StatCard label="Leads" value="47" delta={{ value: '+6%', positive: true }} icon={UserPlus} />
        <StatCard label="Appointments" value="61" delta={{ value: '+8%', positive: true }} icon={CalendarCheck} />
        <StatCard label="Talk time" value="11h 42m" delta={{ value: '+3%', positive: true }} icon={Clock} />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Segmented label="Call view" options={['All calls', 'Needs attention']} value={tab} onChange={setTab} />
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="call-search" className="sr-only">
              Search calls
            </label>
            <input
              id="call-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search calls…"
              className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
          {tab === 'All calls' && (
            <SimpleSelect
              label="Period"
              className="w-36"
              defaultValue="7d"
              options={[
                { value: 'today', label: 'Today' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
              ]}
            />
          )}
        </div>
      </div>

      {tab === 'Needs attention' && (
        <div className="flex items-center gap-3 rounded-xl bg-warning/10 px-4 py-3 text-sm ring-1 ring-inset ring-warning/30">
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
          <span>
            {rows.length} calls need a follow-up. Resolve them to keep your response time under 15 minutes.
          </span>
        </div>
      )}

      <Panel bodyClassName="p-0">
        {tab === 'All calls' && (
          <div className="overflow-x-auto border-b px-2">
            <div role="tablist" aria-label="Outcome filter" className="flex min-w-max gap-1 py-2">
              {filters.map((f) => (
                <button
                  key={f.label}
                  role="tab"
                  type="button"
                  aria-selected={filter === f.label}
                  onClick={() => setFilter(f.label)}
                  className={cn(
                    'h-8 rounded-md px-3 text-sm font-medium transition-colors',
                    filter === f.label ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {rows.length ? (
          <CallsTable calls={rows} showRecording />
        ) : (
          <EmptyState icon={PhoneIncoming} title="No calls match" description="Try a different filter or search term." />
        )}
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing <span className="font-medium text-foreground">{rows.length}</span> of 284 calls
          </span>
          <div className="flex gap-1">
            <button type="button" disabled className="flex size-8 items-center justify-center rounded-md border disabled:opacity-40">
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span className="sr-only">Previous page</span>
            </button>
            <Link href="/voice/calls" className="flex size-8 items-center justify-center rounded-md border hover:bg-muted">
              <ChevronRight className="size-4" aria-hidden="true" />
              <span className="sr-only">Next page</span>
            </Link>
          </div>
        </div>
      </Panel>
    </>
  )
}
