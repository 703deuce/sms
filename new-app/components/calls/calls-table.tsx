'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Mic, PhoneOff, Voicemail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput, SegmentedFilter, SimpleSelect } from '@/components/app/filters'
import { EmptyState } from '@/components/app/page-primitives'
import { AI_OUTCOME, CALL_OUTCOME, MCTB_STATE, StatusBadge } from '@/components/app/status'
import { CALLS, NUMBERS, getNumber, type Call } from '@/lib/data'
import { fetchCalls, fetchPowerCampaigns } from '@/lib/phone-api'
import { Input } from '@/components/ui/input'
import { fetchReceptionistCalls } from '@/lib/receptionist-api'
import { useNumbers } from '@/components/providers/numbers-provider'
import { mapPhoneCallDtoToCall } from '@/lib/phone-ui-map'
import { formatDuration, formatPhone, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'

type Variant = 'phone' | 'receptionist' | 'mctb' | 'power_dialer'
const PAGE = 12

const FILTERS: Record<Variant, { value: string; label: string; test: (c: Call) => boolean }[]> = {
  phone: [
    { value: 'all', label: 'All', test: () => true },
    { value: 'inbound', label: 'Inbound', test: (c) => c.direction === 'inbound' },
    { value: 'outbound', label: 'Outbound', test: (c) => c.direction === 'outbound' },
    { value: 'missed', label: 'Missed', test: (c) => c.outcome === 'missed' },
    { value: 'voicemail', label: 'Voicemail', test: (c) => c.outcome === 'voicemail' },
    { value: 'unhandled', label: 'Needs follow-up', test: (c) => c.callbackNeeded && !c.handled },
  ],
  receptionist: [
    { value: 'all', label: 'All', test: () => true },
    { value: 'booked', label: 'Booked', test: (c) => c.ai?.outcome === 'booked' && !/reschedul|cancel/i.test(c.ai.intent) },
    { value: 'rescheduled', label: 'Rescheduled', test: (c) => /reschedul/i.test(c.ai?.intent ?? '') },
    { value: 'cancelled', label: 'Cancelled', test: (c) => /cancel/i.test(c.ai?.intent ?? '') },
    { value: 'transferred', label: 'Transferred', test: (c) => c.ai?.outcome === 'transferred' },
    { value: 'callback', label: 'Callback', test: (c) => c.ai?.outcome === 'callback' },
    { value: 'message', label: 'Message taken', test: (c) => c.ai?.outcome === 'message' },
    { value: 'unresolved', label: 'Unresolved', test: (c) => c.ai?.outcome === 'unresolved' },
    { value: 'failed', label: 'Failed', test: (c) => c.ai?.outcome === 'failed' || !!c.ai?.tools.some((t) => t.status === 'failed') },
    { value: 'open', label: 'Open follow-up', test: (c) => c.ai?.followUp === 'open' },
  ],
  power_dialer: [
    { value: 'all', label: 'All', test: () => true },
    { value: 'outbound', label: 'Outbound', test: (c) => c.direction === 'outbound' },
    { value: 'missed', label: 'No answer', test: (c) => c.outcome === 'missed' },
    { value: 'voicemail', label: 'Voicemail', test: (c) => c.outcome === 'voicemail' },
  ],
  mctb: [
    { value: 'all', label: 'All', test: () => true },
    { value: 'needs', label: 'Needs callback', test: (c) => c.mctb?.state === 'needs_callback' || c.mctb?.state === 'replied' },
    { value: 'texted', label: 'Texted', test: (c) => c.mctb?.state === 'texted' },
    { value: 'no_consent', label: 'No consent', test: (c) => c.mctb?.state === 'consent_pending' || c.mctb?.state === 'declined' },
    { value: 'suppressed', label: 'Suppressed / failed', test: (c) => c.mctb?.state === 'suppressed' || c.mctb?.state === 'failed' },
  ],
}

const BASE_FILTER: Record<Variant, (c: Call) => boolean> = {
  phone: () => true,
  receptionist: (c) => !!c.ai,
  mctb: (c) => !!c.mctb,
  power_dialer: () => true,
}

export function CallsTable({ variant, basePath, initialFilter = 'all' }: { variant: Variant; basePath: string; initialFilter?: string }) {
  const { owned } = useNumbers()
  const [filter, setFilter] = useState(initialFilter)
  const [numberId, setNumberId] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [liveCalls, setLiveCalls] = useState<Call[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [campaignId, setCampaignId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dispositionQ, setDispositionQ] = useState('')
  const [recordingFilter, setRecordingFilter] = useState('all')
  const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (variant !== 'power_dialer') return
    void fetchPowerCampaigns()
      .then((rows) => setCampaignOptions(rows.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => undefined)
  }, [variant])

  useEffect(() => {
    if (variant !== 'phone' && variant !== 'receptionist' && variant !== 'power_dialer') return
    let cancelled = false
    void (async () => {
      try {
        setLoadError(null)
        const filterParam =
          filter === 'all'
            ? undefined
            : filter === 'attention'
              ? 'open'
              : filter
        if (variant === 'phone' || variant === 'power_dialer') {
          const res = await fetchCalls({
            page,
            limit: PAGE,
            filter: filterParam,
            numberId: numberId === 'all' ? undefined : numberId,
            q: q.trim() || undefined,
            direction: variant === 'power_dialer' ? 'outbound' : undefined,
            source: variant === 'power_dialer' ? 'power_dialer' : undefined,
            campaignId: variant === 'power_dialer' && campaignId !== 'all' ? campaignId : undefined,
            from: variant === 'power_dialer' && dateFrom ? dateFrom : undefined,
            to: variant === 'power_dialer' && dateTo ? dateTo : undefined,
            disposition: variant === 'power_dialer' && dispositionQ.trim() ? dispositionQ.trim() : undefined,
            hasRecording:
              variant === 'power_dialer'
                ? recordingFilter === 'yes'
                  ? '1'
                  : recordingFilter === 'no'
                    ? '0'
                    : undefined
                : undefined,
          })
          if (cancelled) return
          setLiveCalls(res.data.map(mapPhoneCallDtoToCall))
          setTotal(res.total)
        } else {
          const res = await fetchReceptionistCalls({
            page,
            limit: PAGE,
            filter: filterParam,
            numberId: numberId === 'all' ? undefined : numberId,
            q: q.trim() || undefined,
          })
          if (cancelled) return
          setLiveCalls(res.data)
          setTotal(res.meta.total)
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load calls')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [variant, page, filter, numberId, q, campaignId, dateFrom, dateTo, dispositionQ, recordingFilter])

  const scoped = useMemo(() => {
    if (variant === 'phone' || variant === 'receptionist' || variant === 'power_dialer') {
      return liveCalls ?? []
    }
    return CALLS.filter(BASE_FILTER[variant])
  }, [variant, liveCalls])
  const filters = FILTERS[variant]

  const rows = useMemo(() => {
    if ((variant === 'phone' || variant === 'receptionist' || variant === 'power_dialer') && liveCalls !== null)
      return scoped
    const test = filters.find((f) => f.value === filter)?.test ?? (() => true)
    const term = q.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')
    return scoped
      .filter(test)
      .filter((c) => numberId === 'all' || c.numberId === numberId)
      .filter(
        (c) =>
          !term ||
          c.caller.toLowerCase().includes(term) ||
          (digits.length >= 3 && c.callerNumber.includes(digits)) ||
          c.ai?.intent.toLowerCase().includes(term),
      )
  }, [scoped, filters, filter, numberId, q, variant, liveCalls])

  const livePaged =
    (variant === 'phone' || variant === 'receptionist' || variant === 'power_dialer') && liveCalls
  const pageCount = Math.max(1, Math.ceil((livePaged ? total : rows.length) / PAGE))
  const current = livePaged ? rows : rows.slice(page * PAGE, page * PAGE + PAGE)
  const reset = () => setPage(0)

  return (
    <div className="flex flex-col rounded-xl surface">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedFilter
          label="Filter calls"
          value={filter}
          onChange={(v) => {
            setFilter(v)
            reset()
          }}
          options={filters.map((f) => ({ value: f.value, label: f.label, count: scoped.filter(f.test).length }))}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SimpleSelect
            label="Filter by number"
            value={numberId}
            onChange={(v) => {
              setNumberId(v)
              reset()
            }}
            options={[
              { value: 'all', label: 'All numbers' },
              ...(variant === 'phone' || variant === 'power_dialer'
                ? owned.map((n) => ({ value: n.id, label: n.nickname || n.number }))
                : NUMBERS.map((n) => ({ value: n.id, label: n.label }))),
            ]}
          />
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              reset()
            }}
            placeholder="Search caller or number"
          />
        </div>
        {variant === 'power_dialer' && (
          <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:flex-wrap">
            <SimpleSelect
              label="Campaign"
              value={campaignId}
              onChange={(v) => {
                setCampaignId(v)
                reset()
              }}
              options={[
                { value: 'all', label: 'All campaigns' },
                ...campaignOptions.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">From</span>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); reset() }} aria-label="From date" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-muted-foreground">To</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); reset() }} aria-label="To date" />
            </label>
            <SearchInput
              value={dispositionQ}
              onChange={(v) => {
                setDispositionQ(v)
                reset()
              }}
              placeholder="Disposition"
            />
            <SimpleSelect
              label="Recording"
              value={recordingFilter}
              onChange={(v) => {
                setRecordingFilter(v)
                reset()
              }}
              options={[
                { value: 'all', label: 'Any recording' },
                { value: 'yes', label: 'Has recording' },
                { value: 'no', label: 'No recording' },
              ]}
            />
          </div>
        )}
      </div>

      {(variant === 'phone' || variant === 'power_dialer') && loadError && (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {loadError}
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => {
              setLiveCalls(null)
              setLoadError(null)
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {current.length === 0 ? (
        <EmptyState
          icon={PhoneOff}
          title="No calls match these filters"
          description="Try a different filter, number, or search term. New activity appears here as soon as it is recorded."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilter('all')
                setNumberId('all')
                setQ('')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">Caller</th>
                  {(variant === 'phone' || variant === 'power_dialer') && (
                    <>
                      <th scope="col" className="px-4 py-2.5 font-medium">Outcome</th>
                      {variant === 'power_dialer' && (
                        <th scope="col" className="px-4 py-2.5 font-medium">Source</th>
                      )}
                      {variant === 'phone' && (
                        <>
                          <th scope="col" className="px-4 py-2.5 font-medium">Routed to</th>
                          <th scope="col" className="px-4 py-2.5 font-medium">Line</th>
                        </>
                      )}
                    </>
                  )}
                  {variant === 'receptionist' && (
                    <>
                      <th scope="col" className="px-4 py-2.5 font-medium">Intent</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Outcome</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Follow-up</th>
                    </>
                  )}
                  {variant === 'mctb' && (
                    <>
                      <th scope="col" className="px-4 py-2.5 font-medium">Recovery</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Consent</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Message</th>
                    </>
                  )}
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Duration</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {current.map((c) => (
                  <tr key={c.id} className="group relative border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`${basePath}/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0 focus-visible:outline-none">
                        <DirectionIcon call={c} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium group-hover:text-primary">{c.caller}</span>
                          <span className="font-mono text-xs text-muted-foreground">{formatPhone(c.callerNumber)}</span>
                        </span>
                      </Link>
                    </td>
                    {(variant === 'phone' || variant === 'power_dialer') && (
                      <>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <StatusBadge tone={CALL_OUTCOME[c.outcome].tone}>{CALL_OUTCOME[c.outcome].label}</StatusBadge>
                            {variant === 'power_dialer' && c.metadata?.crmSync && typeof c.metadata.crmSync === 'object' && (
                              <StatusBadge
                                tone={
                                  (c.metadata.crmSync as { status?: string }).status === 'succeeded'
                                    ? 'success'
                                    : (c.metadata.crmSync as { status?: string }).status === 'failed'
                                      ? 'danger'
                                      : 'muted'
                                }
                              >
                                CRM {(c.metadata.crmSync as { status?: string }).status}
                              </StatusBadge>
                            )}
                            {c.callbackNeeded && !c.handled && <StatusBadge tone="warning">Follow up</StatusBadge>}
                          </span>
                        </td>
                        {variant === 'power_dialer' && (
                          <td className="px-4 py-3 text-xs">
                            {c.callSource ? (
                              <span className="flex flex-col gap-0.5">
                                <span>{c.callSource.label}</span>
                                {c.callSource.campaignId && (
                                  <Link
                                    href={`/app/power-dialer/campaigns/${c.callSource.campaignId}`}
                                    className="text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Campaign
                                  </Link>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        {variant === 'phone' && (
                          <>
                            <td className="max-w-56 px-4 py-3">
                              <span className="block truncate">{c.routedTo}</span>
                              {c.user && <span className="text-xs text-muted-foreground">{c.user}</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {c.routedTo || c.lineSummary?.label || '—'}
                            </td>
                          </>
                        )}
                      </>
                    )}
                    {variant === 'receptionist' && c.ai && (
                      <>
                        <td className="max-w-64 px-4 py-3">
                          <span className="block truncate">{c.ai.intent}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={AI_OUTCOME[c.ai.outcome].tone}>{AI_OUTCOME[c.ai.outcome].label}</StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{c.ai.followUp === 'none' ? '—' : c.ai.followUp}</td>
                      </>
                    )}
                    {variant === 'mctb' && c.mctb && (
                      <>
                        <td className="px-4 py-3">
                          <StatusBadge tone={MCTB_STATE[c.mctb.state].tone}>{MCTB_STATE[c.mctb.state].label}</StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.mctb.pressOne === 'pressed' ? 'Pressed 1' : c.mctb.pressOne === 'no_input' ? 'No input' : c.mctb.pressOne === 'declined' ? 'Declined' : 'Not offered'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{c.mctb.messageStatus.replace('_', ' ')}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right font-mono text-xs tabular text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {c.recording && <Mic className="size-3.5" aria-label="Recording available" />}
                        {c.voicemail && <Voicemail className="size-3.5" aria-label="Voicemail" />}
                        {formatDuration(c.durationSec)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-muted-foreground">{formatWhen(c.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col md:hidden">
            {current.map((c) => {
              const badge =
                variant === 'receptionist' && c.ai
                  ? AI_OUTCOME[c.ai.outcome]
                  : variant === 'mctb' && c.mctb
                    ? MCTB_STATE[c.mctb.state]
                    : CALL_OUTCOME[c.outcome]
              return (
                <li key={c.id} className="border-b last:border-0">
                  <Link href={`${basePath}/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                    <DirectionIcon call={c} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.caller}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(c.startedAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                        <span className="truncate text-xs text-muted-foreground">{c.ai?.intent ?? c.routedTo}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              {page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DirectionIcon({ call }: { call: Call }) {
  const Icon = call.direction === 'outbound' ? ArrowUpRight : ArrowDownLeft
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
        call.outcome === 'missed' && 'bg-destructive/10 text-destructive',
        call.outcome === 'ai_handled' && 'bg-accent text-accent-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{call.direction}</span>
    </span>
  )
}
