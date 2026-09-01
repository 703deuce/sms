'use client'

import { Search, ListFilter, Users, MessageSquare, Paperclip, MoreVertical, Megaphone, Plus } from 'lucide-react'
import { campaigns as baseCampaigns, Campaign } from '../mock-data'

interface Props {
  extraCampaigns: Campaign[]
  onCreate: () => void
}

const statusStyles: Record<Campaign['status'], string> = {
  Draft: 'bg-muted text-muted-foreground border border-border',
  Sent: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Sending: 'bg-primary/10 text-primary border border-primary/20',
}

function StatusPill({ status }: { status: Campaign['status'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[status]}`}
    >
      {status === 'Sending' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
      )}
      {status}
    </span>
  )
}

export default function CampaignList({ extraCampaigns, onCreate }: Props) {
  const all = [...extraCampaigns, ...baseCampaigns]

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Campaigns</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              View and manage all of your campaigns.
            </p>
          </div>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
        >
          <Plus size={15} strokeWidth={2.5} />
          Create Campaign
        </button>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-foreground shadow-sm transition hover:bg-muted/60">
          <ListFilter size={14} className="text-muted-foreground" />
          Filter
        </button>
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search campaigns"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Table / empty state */}
      {all.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone size={18} />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-foreground">No campaigns found</h3>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Create your first campaign to reach your audience.
          </p>
          <button
            onClick={onCreate}
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus size={15} strokeWidth={2.5} />
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[minmax(220px,1.6fr)_120px_64px_72px_72px_90px_104px_36px] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Campaign</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Audience</span>
            <span />
            <span className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Clicks</span>
            <span className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unsubs</span>
            <span className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {all.map((c) => {
              const showStats = c.status === 'Sent' || c.status === 'Sending'
              return (
                <div
                  key={c.id}
                  className="group grid grid-cols-[minmax(220px,1.6fr)_120px_64px_72px_72px_90px_104px_36px] items-center gap-3 px-4 py-3.5 transition hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{c.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold tabular-nums text-foreground">
                      {c.contacts.toLocaleString()}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users size={11} />
                      {c.audienceType}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare size={14} />
                    {c.hasAttachment && <Paperclip size={13} />}
                  </div>
                  <span className="text-right text-[13px] tabular-nums text-foreground">
                    {showStats ? c.clicks : <span className="text-muted-foreground/60">—</span>}
                  </span>
                  <span className="text-right text-[13px] tabular-nums text-foreground">
                    {showStats ? c.unsubs : <span className="text-muted-foreground/60">—</span>}
                  </span>
                  <span className="text-right text-[13px] font-semibold tabular-nums text-foreground">
                    {showStats ? c.revenue : <span className="font-normal text-muted-foreground/60">—</span>}
                  </span>
                  <span>
                    <StatusPill status={c.status} />
                  </span>
                  <span className="flex justify-end">
                    <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100">
                      <MoreVertical size={15} />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
