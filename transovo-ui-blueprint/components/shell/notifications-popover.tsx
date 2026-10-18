'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { NOTIFICATIONS } from '@/lib/data'
import { formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'

const toneDot: Record<string, string> = {
  callback: 'bg-primary',
  warning: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-muted-foreground',
}

export function NotificationsPopover() {
  const [items, setItems] = useState(NOTIFICATIONS)
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label={`Notifications, ${unread} unread`}>
            <Bell />
            {unread > 0 && (
              <span aria-hidden className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-warning-foreground">
                {unread}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="link" size="xs" onClick={() => setItems((all) => all.map((n) => ({ ...n, read: true })))} disabled={!unread}>
            Mark all read
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.map((n) => (
            <li key={n.id} className="border-b last:border-0">
              <Link
                href={n.href}
                onClick={() => {
                  setItems((all) => all.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
                  setOpen(false)
                }}
                className="flex gap-3 px-4 py-3 hover:bg-muted"
              >
                <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-border' : toneDot[n.kind])} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn('text-sm', !n.read && 'font-medium')}>{n.title}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                  <span className="text-[11px] text-muted-foreground">{formatWhen(n.at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
