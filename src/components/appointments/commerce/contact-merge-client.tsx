'use client'

import { useState } from 'react'

type MergePreview = {
  sourceContactId: string
  targetContactId: string
  conflicts: Record<string, { source: string | null; target: string | null }>
  appointmentCounts: { source: number; target: number }
}

export function ContactMergeClient() {
  const [sourceContactId, setSourceContactId] = useState('')
  const [targetContactId, setTargetContactId] = useState('')
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [chosenValues, setChosenValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runPreview() {
    if (!sourceContactId.trim() || !targetContactId.trim()) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/appointments/service-booking/contact-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceContactId: sourceContactId.trim(),
          targetContactId: targetContactId.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Preview failed')
      setPreview(json.data as MergePreview)
      const defaults: Record<string, string> = {}
      for (const [field, vals] of Object.entries((json.data as MergePreview).conflicts)) {
        defaults[field] = vals.target || vals.source || ''
      }
      setChosenValues(defaults)
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  async function runMerge() {
    if (!preview) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/appointments/service-booking/contact-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge',
          sourceContactId: preview.sourceContactId,
          targetContactId: preview.targetContactId,
          chosenValues,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Merge failed')
      setMessage('Contacts merged successfully.')
      setPreview(null)
      setSourceContactId('')
      setTargetContactId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>Source contact ID (will be removed)</span>
          <input
            className="rounded border px-3 py-2 font-mono text-xs"
            value={sourceContactId}
            onChange={(e) => setSourceContactId(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Target contact ID (will remain)</span>
          <input
            className="rounded border px-3 py-2 font-mono text-xs"
            value={targetContactId}
            onChange={(e) => setTargetContactId(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2 disabled:opacity-50"
          disabled={loading}
          onClick={() => void runPreview()}
        >
          {loading ? 'Working…' : 'Preview merge'}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Appointments to move: {preview.appointmentCounts.source} → target has{' '}
            {preview.appointmentCounts.target}
          </p>
          {Object.keys(preview.conflicts).length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Resolve conflicts</p>
              {Object.entries(preview.conflicts).map(([field, vals]) => (
                <label key={field} className="flex flex-col gap-1 text-sm">
                  <span className="capitalize">{field}</span>
                  <select
                    className="rounded border px-3 py-2"
                    value={chosenValues[field] || ''}
                    onChange={(e) =>
                      setChosenValues((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                  >
                    {vals.source ? <option value={vals.source}>Source: {vals.source}</option> : null}
                    {vals.target ? <option value={vals.target}>Target: {vals.target}</option> : null}
                  </select>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No field conflicts — safe to merge.</p>
          )}
          <button
            type="button"
            className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50"
            disabled={loading}
            onClick={() => void runMerge()}
          >
            Merge contacts
          </button>
        </div>
      ) : null}
    </div>
  )
}
