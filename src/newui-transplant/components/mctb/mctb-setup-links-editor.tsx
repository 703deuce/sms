'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Link2, Lock, Plus, Trash2 } from 'lucide-react'
import type { MctbBookingLinkDto } from '@/lib/mctb/booking-links/service'
import { bookingLinkHostname, validateBookingLinkUrl } from '@/lib/mctb/booking-links/validate-url'
import {
  DEFAULT_MCTB_REQUEST_FORM_FIELDS,
  mctbRequestFormPublicPath,
  type MctbRequestFormField,
} from '@/lib/mctb/request-form-shared'
import { FieldRow, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { saveMctbSetup } from '@/lib/newui-transplant/api/mctb-setup-client'

export function MctbSetupLinksEditor() {
  const [loading, setLoading] = useState(true)
  const [recoveryPaid, setRecoveryPaid] = useState(false)
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null)
  const [links, setLinks] = useState<MctbBookingLinkDto[]>([])
  const [defaultLinkUrl, setDefaultLinkUrl] = useState('')
  const [requestFormEnabled, setRequestFormEnabled] = useState(false)
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false)
  const [requestFormUrl, setRequestFormUrl] = useState<string | null>(null)
  const [fields, setFields] = useState<MctbRequestFormField[]>(DEFAULT_MCTB_REQUEST_FORM_FIELDS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formLabel, setFormLabel] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [linksRes, setupRes] = await Promise.all([
        fetch('/api/mctb/booking-links'),
        fetch('/api/mctb/setup', { cache: 'no-store' }),
      ])
      const linksJson = await linksRes.json()
      const setupJson = await setupRes.json()
      const setup = setupJson.data ?? setupJson
      setRecoveryPaid(Boolean(setup.capabilities?.recoveryPaid ?? setup.consentMeta?.paidEntitled))
      const r = setup.runtime as Record<string, unknown>
      setPhoneNumberId((r.phoneNumberId as string) ?? null)
      setDefaultLinkUrl(String(r.defaultLinkUrl || ''))
      setRequestFormEnabled(Boolean(r.requestFormEnabled))
      setLeadCaptureEnabled(Boolean(r.leadCaptureEnabled))
      const loadedFields =
        Array.isArray(r.requestFormFieldsJson) && (r.requestFormFieldsJson as unknown[]).length
          ? (r.requestFormFieldsJson as MctbRequestFormField[])
          : DEFAULT_MCTB_REQUEST_FORM_FIELDS
      setFields(loadedFields)
      const token = r.requestFormToken as string | undefined
      setRequestFormUrl(token ? mctbRequestFormPublicPath(token) : null)
      setLinks((linksJson.data || []) as MctbBookingLinkDto[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveSetupFields = async () => {
    if (!phoneNumberId) throw new Error('Configure Phone & Forwarding first.')
    await saveMctbSetup({
      phoneNumberId,
      defaultLinkUrl: defaultLinkUrl.trim() || null,
      requestFormEnabled,
      leadCaptureEnabled,
      requestFormFieldsJson: fields,
      activate: false,
    })
    await reload()
  }

  const openNewLink = () => {
    setEditingId(null)
    setFormLabel('')
    setFormUrl('')
    setDrawerOpen(true)
  }

  const openEdit = (row: MctbBookingLinkDto) => {
    setEditingId(row.id)
    setFormLabel(row.label)
    setFormUrl(row.url)
    setDrawerOpen(true)
  }

  const saveLink = async () => {
    setError(null)
    const v = validateBookingLinkUrl(formUrl)
    if (!v.ok) {
      setError(v.error || 'Invalid URL')
      return
    }
    const body = {
      label: formLabel.trim() || 'Link',
      url: formUrl.trim(),
      active: true,
      isDefault: links.length === 0,
    }
    const res = editingId
      ? await fetch(`/api/mctb/booking-links/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : await fetch('/api/mctb/booking-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Could not save link')
    setDrawerOpen(false)
    await reload()
  }

  const deleteLink = async (id: string) => {
    const res = await fetch(`/api/mctb/booking-links/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json()
      throw new Error(j.error || 'Could not delete link')
    }
    await reload()
  }

  const setDefaultFromLink = async (row: MctbBookingLinkDto) => {
    setDefaultLinkUrl(row.url)
    await saveMctbSetup({
      phoneNumberId,
      defaultLinkUrl: row.url,
      activate: false,
    })
    await reload()
  }

  const copyRequestForm = async () => {
    if (!requestFormUrl) return
    const absolute = `${window.location.origin}${requestFormUrl}`
    await navigator.clipboard.writeText(absolute)
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading links…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Booking & tracking links"
        description="Used in recovery messages and AI Recovery when entitled."
        action={
          recoveryPaid ? (
            <Button type="button" size="sm" variant="outline" onClick={openNewLink}>
              <Plus /> Add link
            </Button>
          ) : (
            <Pill tone="warning">
              <Lock className="mr-1 size-3" aria-hidden /> Recovery plan
            </Pill>
          )
        }
        bodyClassName="p-0"
      >
        {links.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            {recoveryPaid
              ? 'No booking links yet. Add a link to use in recovery or AI booking flows.'
              : 'Booking links unlock with Recovery. You can still configure the default URL and request form below.'}
          </p>
        ) : (
          <ul className="divide-y">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Link2 className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {l.label}
                    {l.isDefault ? <Pill tone="primary">Default</Pill> : null}
                    {defaultLinkUrl === l.url ? <Pill tone="success">Recovery URL</Pill> : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{bookingLinkHostname(l.url)}</p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => void setDefaultFromLink(l)}>
                    Use in recovery
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(l)}>Edit</Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Delete ${l.label}`} onClick={() => void deleteLink(l.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Default recovery link" description="Inserted as {booking_link} when no request form is used.">
        <Input
          value={defaultLinkUrl}
          onChange={(e) => setDefaultLinkUrl(e.target.value)}
          placeholder="https://"
          aria-label="Default booking link URL"
        />
        <div className="mt-4 flex justify-end">
          <SaveBar onSave={saveSetupFields} />
        </div>
      </Panel>

      <Panel title="Public request form">
        <FieldRow label="Enable request form" description="Send a structured form link instead of a single URL when appropriate.">
          <Switch checked={requestFormEnabled} onCheckedChange={setRequestFormEnabled} aria-label="Enable request form" />
        </FieldRow>
        <FieldRow label="Lead capture" description="Store submissions as leads when callers complete the form.">
          <Switch checked={leadCaptureEnabled} onCheckedChange={setLeadCaptureEnabled} aria-label="Lead capture" />
        </FieldRow>
        {requestFormUrl ? (
          <div className="mt-4 flex gap-2 border-t pt-4">
            <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}${requestFormUrl}`} className="font-mono text-xs" aria-label="Request form URL" />
            <Button type="button" variant="outline" aria-label="Copy request form URL" onClick={() => void copyRequestForm()}>
              <Copy />
            </Button>
          </div>
        ) : null}
        <p className="mt-4 text-sm font-medium">Form fields</p>
        <ul className="mt-2 space-y-2">
          {fields.map((f, i) => (
            <li key={f.id} className="flex gap-2">
              <Input
                value={f.label}
                onChange={(e) => {
                  const next = [...fields]
                  next[i] = { ...f, label: e.target.value }
                  setFields(next)
                }}
                aria-label={`Field ${i + 1} label`}
              />
              <Input
                value={f.type}
                onChange={(e) => {
                  const next = [...fields]
                  next[i] = { ...f, type: e.target.value as MctbRequestFormField['type'] }
                  setFields(next)
                }}
                aria-label={`Field ${i + 1} type`}
                className="w-28"
              />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <SaveBar label="Save form settings" onSave={saveSetupFields} />
        </div>
      </Panel>

      {drawerOpen ? (
        <Panel title={editingId ? 'Edit link' : 'Add link'}>
          {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
          <div className="space-y-3">
            <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Label" aria-label="Link label" />
            <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://" aria-label="Link URL" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button type="button" onClick={() => void saveLink().catch((e) => setError(e instanceof Error ? e.message : 'Save failed'))}>
                Save link
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  )
}
