'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'

type AuditRow = { id: string; action: string; createdAt: string; detailJson?: unknown }
type ListRow = { id: string; name: string; dialConsentJson?: { basis?: string; attestedAt?: string } | null }

export function PowerDialerComplianceSettingsPanel() {
  const [dnc, setDnc] = useState<{ phone: string; reason: string | null }[]>([])
  const [ackAt, setAckAt] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [search, setSearch] = useState('')
  const [csvText, setCsvText] = useState('')
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [lists, setLists] = useState<ListRow[]>([])
  const [legalNotice, setLegalNotice] = useState('')
  const [externalDnc, setExternalDnc] = useState(false)
  const [abandoned, setAbandoned] = useState<
    Record<
      string,
      {
        campaignName: string
        abandonedRatePct: number | null
        hardStopActive?: boolean
        autoThrottleActive?: boolean
        reportingPeriodDays?: number
      }
    >
  >({})

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/compliance')
      .then((r) => r.json())
      .then((j) => {
        setDnc(j.data?.internalDnc || [])
        setAckAt(j.data?.settings?.complianceAcknowledgedAt || null)
        setAudit(j.data?.audit || [])
        setLists(j.data?.lists || [])
        setLegalNotice(j.data?.legalNotice || '')
        setExternalDnc(Boolean(j.data?.externalDncConnected))
        setAbandoned(j.data?.abandonedByCampaign || {})
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const acknowledge = async () => {
    const res = await fetch('/api/phone/power-dialer/compliance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge_compliance' }),
    })
    if (!res.ok) {
      toast.error('Could not save acknowledgement')
      return
    }
    toast.success('Compliance acknowledgement recorded')
    load()
  }

  const addDnc = async () => {
    const res = await fetch('/api/phone/power-dialer/compliance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_dnc', phone }),
    })
    if (!res.ok) {
      toast.error('Could not add number')
      return
    }
    setPhone('')
    load()
    toast.success('Added to internal DNC')
  }

  const saveListConsent = async (listId: string, basis: string, notes: string) => {
    const res = await fetch('/api/phone/power-dialer/compliance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_list_consent', listId, basis, notes }),
    })
    if (!res.ok) {
      toast.error('Could not save list consent basis')
      return
    }
    toast.success('List consent basis recorded')
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Legal & usage (P24)" description="Not legal advice — counsel review required before commercial enablement.">
        <p className="text-sm text-muted-foreground">{legalNotice || 'Loading…'}</p>
      </Panel>
      <Panel title="Admin acknowledgement" description="Required before the first power-dialer session can start.">
        <p className="mb-3 text-sm text-muted-foreground">
          {ackAt
            ? `Acknowledged ${new Date(ackAt).toLocaleString()}`
            : 'Not acknowledged yet — an admin must confirm responsibility for lawful calling practices.'}
        </p>
        {!ackAt && (
          <Button type="button" size="sm" onClick={() => void acknowledge()}>
            I acknowledge calling compliance responsibilities
          </Button>
        )}
      </Panel>
      <Panel title="Internal do-not-call list">
        <div className="mb-3 flex max-w-md gap-2">
          <Input placeholder="Search or filter" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search DNC" />
        </div>
        <div className="mb-3 flex max-w-md gap-2">
          <Input placeholder="+1…" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone to block" />
          <Button type="button" size="sm" onClick={() => void addDnc()}>Add</Button>
        </div>
        <label className="mb-3 flex flex-col gap-1 text-sm">
          <span className="font-medium">Import DNC CSV (phone column required)</span>
          <textarea
            className="min-h-[80px] rounded-md border p-2 font-mono text-xs"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void fetch('/api/phone/power-dialer/compliance', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'import_dnc_csv', csvText }),
              })
                .then((r) => r.json())
                .then((j) => {
                  toast.success(`DNC import: ${j.data.added} added, ${j.data.skipped} skipped, ${j.data.invalid} invalid`)
                  setCsvText('')
                  load()
                })
            }}
          >
            Import CSV
          </Button>
        </label>
        <ul className="text-sm">
          {dnc
            .filter((r) => !search.trim() || r.phone.includes(search.replace(/\D/g, '')))
            .map((r) => (
            <li key={r.phone} className="flex items-center justify-between border-b py-2 font-mono text-xs">
              <span>
                {r.phone}
                {r.reason && <span className="ml-2 text-muted-foreground">{r.reason}</span>}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  void fetch('/api/phone/power-dialer/compliance', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'remove_dnc', phone: r.phone }),
                  }).then(() => load())
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="List permission exceptions (M55)">
        <p className="mb-3 text-sm text-muted-foreground">
          Records evidentiary basis for a calling list. Does not override opt-outs, internal DNC, or statutory restrictions.
        </p>
        <ul className="space-y-3 text-sm">
          {lists.length === 0 && <li className="text-muted-foreground">No lists in workspace.</li>}
          {lists.map((list) => (
            <li key={list.id} className="rounded border p-3">
              <p className="font-medium">{list.name}</p>
              <p className="text-xs text-muted-foreground">
                {list.dialConsentJson?.attestedAt
                  ? `Recorded: ${list.dialConsentJson.basis} · ${new Date(list.dialConsentJson.attestedAt).toLocaleString()}`
                  : 'No attestation on file'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['existing_permission', 'lead_form', 'purchased_list', 'other'] as const).map((basis) => (
                  <Button
                    key={basis}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void saveListConsent(list.id, basis, `Attested via compliance settings`)}
                  >
                    Attest: {basis.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="External DNC screening (M54)">
        <p className="mb-2 text-sm text-muted-foreground">
          Requires your workspace&apos;s own FTC National DNC subscription or qualified provider. Transovo does not share seller SAN data across customers.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={externalDnc}
            onChange={(e) => {
              void fetch('/api/phone/power-dialer/compliance', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_external_dnc', connected: e.target.checked }),
              }).then(() => load())
            }}
          />
          External DNC screening connected for this workspace
        </label>
      </Panel>
      <Panel title="Abandoned-call metrics (M59)">
        {Object.keys(abandoned).length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          <ul className="text-sm">
            {Object.entries(abandoned).map(([id, row]) => (
              <li key={id} className="border-b py-2">
                {row.campaignName}:{' '}
                {row.abandonedRatePct != null
                  ? `${row.abandonedRatePct}% abandoned (${row.reportingPeriodDays ?? 30}d)`
                  : '—'}
                {row.hardStopActive ? ' · hard stop active' : row.autoThrottleActive ? ' · auto-throttle' : ''}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Compliance audit log">
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No compliance decisions logged yet.</p>
        ) : (
          <ul className="max-h-64 overflow-auto text-xs">
            {audit.map((a) => (
              <li key={a.id} className="border-b py-2">
                <span className="font-mono text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                {' · '}
                <span className="font-medium">{a.action}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
