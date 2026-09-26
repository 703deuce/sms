'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, PhoneOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/app/kit'
import { RecentCallsTable } from '@/components/voice/recent-calls-table'
import { VOICE_CALLS, type CallOutcome } from '@/lib/data'
import { cn } from '@/lib/utils'

const FILTERS: { label: string; value: CallOutcome | 'all' }[] = [
  { label: 'All Calls', value: 'all' },
  { label: 'Leads', value: 'Lead' },
  { label: 'Appointments', value: 'Appointment' },
  { label: 'Messages', value: 'Message' },
  { label: 'Transfers', value: 'Transfer' },
  { label: 'Voicemails', value: 'Voicemail' },
  { label: 'No Answer', value: 'No Answer' },
]

const PERIODS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]

export function CallsBrowser() {
  const [mode, setMode] = useState<'all' | 'attention'>('all')
  const [filter, setFilter] = useState<CallOutcome | 'all'>('all')
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('7d')

  const calls = useMemo(() => {
    const q = query.trim().toLowerCase()
    return VOICE_CALLS.filter((c) => {
      if (mode === 'attention' && !c.attention) return false
      if (mode === 'all' && filter !== 'all' && c.outcome !== filter) return false
      if (q && !`${c.caller} ${c.phone}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [mode, filter, query])

  const attentionCount = VOICE_CALLS.filter((c) => c.attention).length

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b px-5 pt-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Call views" className="flex gap-5">
          {(['all', 'attention'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'relative flex h-10 items-center gap-2 text-sm transition-colors',
                mode === m ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'all' ? 'All calls' : 'Needs attention'}
              {m === 'attention' ? (
                <span className="rounded-full bg-warning/15 px-1.5 text-[11px] font-medium tabular-nums">{attentionCount}</span>
              ) : null}
              {mode === m ? <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" /> : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-3 md:pb-0">
          <div className="relative flex-1 md:w-64 md:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search calls…"
              aria-label="Search calls"
              className="pl-8"
            />
          </div>
          {mode === 'all' ? (
            <Select value={period} onValueChange={(v) => v && setPeriod(v)} items={PERIODS}>
              <SelectTrigger className="w-36" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {mode === 'all' ? (
        <div className="flex gap-1.5 overflow-x-auto border-b px-5 py-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filter === f.value
                  ? 'border-foreground bg-foreground text-background'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="border-b bg-warning/5 px-5 py-3 text-xs text-muted-foreground">
          Calls with callback requests, knowledge gaps, or failed transfers that still need a human.
        </p>
      )}

      {calls.length ? (
        <RecentCallsTable calls={calls} showRecording />
      ) : (
        <EmptyState icon={PhoneOff} title="No calls match" description="Try a different filter or clear your search." />
      )}

      <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{calls.length}</span> of {VOICE_CALLS.length} calls
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" disabled aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
