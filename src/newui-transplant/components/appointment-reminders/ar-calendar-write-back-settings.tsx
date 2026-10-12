'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Panel } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'

type WriteBackConfig = {
  enabled?: boolean
  colorCodingEnabled?: boolean
}

export function ArCalendarWriteBackSettingsPanel({ compact }: { compact?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [colorCoding, setColorCoding] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/appointment-reminders/settings')
      const json = await res.json()
      const cfg = (json.data?.appointmentReminders?.calendarWriteBack || {}) as WriteBackConfig
      setEnabled(cfg.enabled !== false)
      setColorCoding(cfg.colorCodingEnabled !== false)
    } catch {
      setError('Could not load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(patch: Partial<WriteBackConfig>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/appointment-reminders/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentReminders: {
            calendarWriteBack: {
              enabled: patch.enabled ?? enabled,
              colorCodingEnabled: patch.colorCodingEnabled ?? colorCoding,
            },
          },
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Save failed')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className={compact ? 'p-3' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Calendar write-back</h3>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Automatically show confirmations, cancellations, and rescheduling updates in your
            connected Microsoft Outlook calendar. Updates the event description and optional Outlook
            category labels — not the event title or meeting link.
          </p>
        </div>
        {!compact ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={AR_ROUTES.settings}>All reminder settings</Link>
          </Button>
        ) : null}
      </div>
      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading…
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>Enable calendar write-back</span>
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={enabled}
              disabled={saving}
              onChange={(e) => {
                const next = e.target.checked
                setEnabled(next)
                void save({ enabled: next })
              }}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>Automatically color-code appointments (Outlook categories)</span>
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={colorCoding}
              disabled={saving || !enabled}
              onChange={(e) => {
                const next = e.target.checked
                setColorCoding(next)
                void save({ colorCodingEnabled: next })
              }}
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Microsoft 365 is supported today. Google Calendar write-back is planned. Writable
            connections use your existing calendar permissions — no new OAuth scopes.
          </p>
        </div>
      )}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Panel>
  )
}
