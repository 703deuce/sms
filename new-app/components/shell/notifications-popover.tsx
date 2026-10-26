'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import { formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'

type Item = { id: string; title: string; body?: string | null; href?: string | null; read: boolean; at: string }

export function NotificationsPopover() {
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read).length

  const load = useCallback(async () => {
    try {
      const data = await clipsFetch<{ items: Item[] }>('/api/notifications')
      setItems(data.items)
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60_000)
    return () => clearInterval(t)
  }, [load])

  const markAll = async () => {
    await clipsFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) })
    setItems((all) => all.map((n) => ({ ...n, read: true })))
  }

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
          <Button variant="link" size="xs" onClick={() => void markAll()} disabled={!unread}>
            Mark all read
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet</li>
          ) : (
            items.map((n) => (
              <li key={n.id} className="border-b last:border-0">
                <Link
                  href={n.href || '/app/streamer'}
                  onClick={() => {
                    void clipsFetch('/api/notifications/read', {
                      method: 'POST',
                      body: JSON.stringify({ ids: [n.id] }),
                    })
                    setItems((all) => all.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
                    setOpen(false)
                  }}
                  className="flex gap-3 px-4 py-3 hover:bg-muted"
                >
                  <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-border' : 'bg-primary')} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn('text-sm', !n.read && 'font-medium')}>{n.title}</span>
                    {n.body ? <span className="text-xs leading-relaxed text-muted-foreground">{n.body}</span> : null}
                    <span className="text-[11px] text-muted-foreground">{formatWhen(n.at)}</span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
