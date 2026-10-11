'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ArOverviewFeedShape } from '@/lib/appointment-reminders/calendar/overview-feed-appointment-row'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { TextLink } from '@/newui-transplant/components/app/kit'
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

function Column({
  title,
  count,
  empty,
  primary,
  secondary,
  onClick,
}: {
  title: string
  count: number
  empty: string
  primary?: string
  secondary?: string
  onClick?: () => void
}) {
  const interactive = Boolean(onClick && primary)
  return (
    <div className="min-w-0 flex-1 border-border lg:border-r lg:last:border-r-0 lg:pr-4 lg:last:pr-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {count > 0 ? (
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{count}</span>
        ) : null}
      </div>
      {primary ? (
        <button
          type="button"
          onClick={onClick}
          disabled={!interactive}
          className={cn(
            'mt-1.5 w-full text-left',
            interactive && 'rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <p className="truncate text-[13px] font-medium text-foreground">{primary}</p>
          {secondary ? <p className="truncate text-[11px] text-muted-foreground">{secondary}</p> : null}
        </button>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">{empty}</p>
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

  const attentionCount = attention.length
  const replyCount = replies.length

  const reminderPreview = useMemo(() => {
    if (!reminderAct) return null
    const failed = /fail/i.test(reminderAct.status)
    return {
      primary: reminderAct.customerLabel,
      secondary: `${reminderAct.reminderLabel} · ${reminderAct.status}`,
      failed,
    }
  }, [reminderAct])

  return (
    <section
      aria-label="Activity and attention"
      className={cn(
        'shrink-0 rounded-xl border border-border bg-card shadow-sm transition-[height] duration-200',
        collapsed ? 'h-10' : 'min-h-[6.5rem]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-1.5">
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
            Needs attention: <strong className="font-medium text-foreground">{attentionCount || '0'}</strong>
          </span>
          <span>
            Replies: <strong className="font-medium text-foreground">{replyCount || '0'}</strong>
          </span>
          <span className="truncate">
            Reminders:{' '}
            <strong className="font-medium text-foreground">
              {reminderAct ? reminderAct.status : '—'}
            </strong>
          </span>
        </div>
      ) : (
        <div className="grid gap-4 px-3 py-3 md:grid-cols-3">
          <Column
            title="Needs attention"
            count={attentionCount}
            empty="All caught up"
            primary={urgent ? urgent.customerName || urgent.title : undefined}
            secondary={urgent ? urgent.reason || urgent.issue : undefined}
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
          <Column
            title="Customer replies"
            count={replyCount}
            empty="No new replies"
            primary={latestReply?.customerName}
            secondary={latestReply?.customerResponse?.label || 'Reply'}
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
          <Column
            title="Reminder activity"
            count={activity.length}
            empty="No upcoming reminders"
            primary={reminderPreview?.primary}
            secondary={reminderPreview?.secondary}
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
