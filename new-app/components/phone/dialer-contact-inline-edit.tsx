'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  contactId: string
  title: string | null
  email: string | null
  customFields: Record<string, unknown> | null
  onSaved: () => void
}

export function DialerContactInlineEdit({ contactId, title, email, customFields, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [localTitle, setLocalTitle] = useState(title || '')
  const [localEmail, setLocalEmail] = useState(email || '')
  const [localCustom, setLocalCustom] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    if (customFields) {
      for (const [k, v] of Object.entries(customFields)) {
        if (typeof v === 'string' || typeof v === 'number') o[k] = String(v)
      }
    }
    return o
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setError(null)
    const prev = { title: localTitle, email: localEmail, custom: { ...localCustom } }
    try {
      const r = await fetch(`/api/crm/native/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: localTitle || null,
          email: localEmail || null,
          customFields: localCustom,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      toast.success('Contact updated')
      setEditing(false)
      onSaved()
    } catch (e) {
      setLocalTitle(prev.title)
      setLocalEmail(prev.email)
      setLocalCustom(prev.custom)
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setEditing(true)}>
        Edit title, email & fields
      </Button>
    )
  }

  const customKeys = Object.keys(localCustom)

  return (
    <div className="mt-2 space-y-2 rounded border p-2 text-xs">
      <label className="block">
        Title
        <Input value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} className="mt-1 h-8" />
      </label>
      <label className="block">
        Email
        <Input type="email" value={localEmail} onChange={(e) => setLocalEmail(e.target.value)} className="mt-1 h-8" />
      </label>
      {customKeys.map((k) => (
        <label key={k} className="block">
          {k}
          <Input
            value={localCustom[k]}
            onChange={(e) => setLocalCustom((c) => ({ ...c, [k]: e.target.value }))}
            className="mt-1 h-8"
          />
        </label>
      ))}
      {error && <p className="text-destructive" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  )
}
