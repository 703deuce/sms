'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bell, CheckCheck, MessageSquare, type LucideIcon } from 'lucide-react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { formatWhen, type Tone } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { usePolled } from './use-ops-data'

type Note = { id: number; kind: string; title: string; body: string; createdAt: string; read: boolean }

/** Bell with the runner's notifications (finished runs, reminders, failures). Marks all read when opened. */
export function NotificationsBell() {
  const { data, reload } = usePolled<{ items: Note[]; unread: number }>('/api/agent-lab/notifications', 30_000)
  const [open, setOpen] = useState(false)
  const unread = data?.unread ?? 0
  const items = data?.items ?? []
  return (
    <Popover
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next)
        if (next && unread > 0) {
          void fetch('/api/agent-lab/notifications', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }).then(reload)
        }
      }}
    >
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'relative')}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {items.length > 0 && <CheckCheck className="size-4 text-muted-foreground" aria-hidden />}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.slice(0, 20).map((n) => (
              <li key={n.id} className="px-3 py-2.5">
                <p className={cn('text-sm', !n.read && 'font-medium')}>{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{formatWhen(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function ChatButton({ label = 'Chat with your agent' }: { label?: string }) {
  return (
    <Link href="/app/agent-lab" className={cn(buttonVariants({ variant: 'default' }), 'gap-2')}>
      <MessageSquare className="size-4" />
      {label}
    </Link>
  )
}

/** Frame for every Agent Lab work page: header with icon, notifications and the chat button. */
export function OpsPage({
  icon,
  title,
  description,
  actions,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Page>
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        breadcrumbs={[{ label: 'Agent Lab', href: '/app/agent-lab' }, { label: title }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <NotificationsBell />
            <ChatButton />
          </div>
        }
      />
      <div className="flex flex-col gap-6">{children}</div>
    </Page>
  )
}

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <StatusBadge tone={tone}>{children}</StatusBadge>
}

export function OpsCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card p-4 shadow-xs transition-colors hover:border-foreground/15',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionHeading({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        {typeof count === 'number' && (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">{count}</span>
        )}
      </h2>
      {action}
    </div>
  )
}

/** A calm, honest empty state. Never stands in for data we do not have. */
export function OpsEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}

export function OpsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
      <span>Couldn&apos;t load this right now. {message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Try again
        </button>
      )}
    </div>
  )
}

export function OpsLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-card" />
      ))}
    </div>
  )
}
