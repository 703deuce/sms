'use client'

import { useMemo, type ReactNode } from 'react'
import { AlertTriangle, Bell, ChevronDown, ChevronRight, ChevronUp, MessageSquare } from 'lucide-react'
import type { ArOverviewFeedShape } from '@/lib/appointment-reminders/calendar/overview-feed-appointment-row'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { Pill, TextLink } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'

export type OperationsStripSelect = {
  appointmentId: string
  startsAt?: string
  tab?: 'details' | 'reminders' | 'activity'
  openConversation?: boolean
}

type Props = {
  data: ArOverviewFeedShape | null
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onSelect: (payload: OperationsStripSelect) => void
  className?: string
}

function statusTone(status: string): 'neutral' | 'warning' | 'danger' | 'primary' {
  const t = status.toLowerCase()
  if (t.includes('fail') || t.includes('block')) return 'danger'
  if (t.includes('past') || t.includes('attention') || t.includes('progress')) return 'warning'
  if (t.includes('sched') || t.includes('sent') || t.includes('deliver')) return 'primary'
  return 'neutral'
}

function StripCard({
  title,
  icon,
  count,
  empty,
  primary,
  secondary,
  statusLabel,
  actionLabel,
  onClick,
}: {
  title: string
  icon: ReactNode
  count: number
  empty: string
  primary?: string
  secondary?: string
  statusLabel?: string
  actionLabel?: string
  onClick?: () => void
}) {
  const interactive = Boolean(onClick && primary)
  return (
    <div className="min-w-0 flex-1 lg:border-r lg:border-border/80 lg:pr-3 lg:last:border-r-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="text-muted-foreground/90" aria-hidden>{icon}</span>
          {title}
        </p>
        {count > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {primary ? (
        <button
          type="button"
          onClick={onClick}
          disabled={!interactive}
          className={cn(
            'group w-full rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2 text-left transition-colors',
            interactive &&
              'hover:border-primary/30 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {statusLabel ? (
                <Pill tone={statusTone(statusLabel)} className="mb-1 text-[10px]">
                  {statusLabel}
                </Pill>
              ) : null}
              <p className="truncate text-[13px] font-semibold text-foreground">{primary}</p>
              {secondary ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{secondary}</p>
              ) : null}
            </div>
            {interactive ? (
              <ChevronRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden
              />
            ) : null}
          </div>
          {actionLabel && interactive ? (
            <p className="mt-1.5 text-[10px] font-medium text-primary">{actionLabel}</p>
          ) : null}
        </button>
      ) : (
        <p className="rounded-lg border border-dashed border-border/70 px-2.5 py-2 text-xs text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  )
}

export function ArCalendarOperationsStrip({ data, collapsed, onCollapsedChange, onSelect, className }: Props) {
  const attention = data?.needsAttentionRows ?? []
  const replies = data?.customerResponses ?? []
  const activity = data?.activity ?? []

  const urgent = attention[0]
  const latestReply = replies[0]
  const reminderAct = activity[0]

  const reminderPreview = useMemo(() => {
    if (!reminderAct) return null
    const failed = /fail/i.test(reminderAct.status)
    const blocked = /block/i.test(reminderAct.status)
    return {
      primary: reminderAct.customerLabel,
      secondary: reminderAct.reminderLabel,
      status: reminderAct.status,
      tone: failed || blocked ? 'danger' : statusTone(reminderAct.status),
    }
  }, [reminderAct])

  return (
    <section
      aria-label="Activity and attention"
      className={cn(
        'shrink-0 rounded-xl border border-border/80 bg-card/95 shadow-sm backdrop-blur-[2px] transition-[height] duration-200',
        collapsed ? 'h-11' : 'min-h-[7.5rem] max-h-[10rem] max-lg:max-h-none',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-1.5">
        <p className="text-xs font-semibold text-foreground">Activity &amp; attention</p>
        <div className="flex items-center gap-2">
          <TextLink href={AR_ROUTES.reminders}>View all</TextLink>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand activity strip' : 'Collapse activity strip'}
          >
            {collapsed ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </Button>
        </div>
      </div>

      {collapsed ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>
            Attention{' '}
            <strong className="font-semibold text-foreground">{attention.length || '0'}</strong>
          </span>
          <span>
            Replies <strong className="font-semibold text-foreground">{replies.length || '0'}</strong>
          </span>
          <span className="truncate">
            Reminders{' '}
            <strong className="font-semibold text-foreground">{reminderAct?.status ?? '—'}</strong>
          </span>
        </div>
      ) : (
        <div className="grid min-h-0 gap-3 px-3 py-2.5 md:grid-cols-3">
          <StripCard
            title="Needs attention"
            icon={<AlertTriangle className="size-3.5" />}
            count={attention.length}
            empty="All caught up"
            primary={urgent ? urgent.customerName || urgent.title : undefined}
            secondary={urgent ? urgent.reason || urgent.issue : undefined}
            statusLabel={urgent ? 'Needs attention' : undefined}
            actionLabel="Open appointment"
            onClick={
              urgent
                ? () =>
                    onSelect({
                      appointmentId: urgent.appointmentId,
                      startsAt: urgent.startsAt,
                      tab: 'details',
                    })
                : undefined
            }
          />
          <StripCard
            title="Customer replies"
            icon={<MessageSquare className="size-3.5" />}
            count={replies.length}
            empty="No new replies"
            primary={latestReply?.customerName}
            secondary={latestReply?.customerResponse?.label || 'New message'}
            statusLabel={latestReply ? 'Reply' : undefined}
            actionLabel="Open conversation"
            onClick={
              latestReply
                ? () =>
                    onSelect({
                      appointmentId: latestReply.appointmentId,
                      startsAt: latestReply.startsAt,
                      tab: 'activity',
                      openConversation: true,
                    })
                : undefined
            }
          />
          <StripCard
            title="Reminder activity"
            icon={<Bell className="size-3.5" />}
            count={activity.length}
            empty="No upcoming reminders"
            primary={reminderPreview?.primary}
            secondary={
              reminderPreview ? `${reminderPreview.secondary} · ${reminderPreview.status}` : undefined
            }
            statusLabel={reminderPreview?.status}
            actionLabel="View reminders"
            onClick={
              reminderAct
                ? () =>
                    onSelect({
                      appointmentId: reminderAct.appointmentId,
                      startsAt: reminderAct.at,
                      tab: 'reminders',
                    })
                : undefined
            }
          />
        </div>
      )}
    </section>
  )
}
