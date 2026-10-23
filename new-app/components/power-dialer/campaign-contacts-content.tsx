'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/app/page-primitives'
import { CampaignSubnav } from '@/components/power-dialer/campaign-subnav'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { fetchCampaignContacts, type CampaignContactRow } from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'

const BUCKETS = [
  { value: 'all', label: 'All' },
  { value: 'eligible', label: 'Eligible' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'completed', label: 'Completed' },
  { value: 'suppressed', label: 'Suppressed' },
  { value: 'failed', label: 'Failed' },
]

export function CampaignContactsContent({ campaignId }: { campaignId: string }) {
  const [rows, setRows] = useState<CampaignContactRow[]>([])
  const [bucket, setBucket] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void fetchCampaignContacts(campaignId, { page, bucket })
      .then((d) => setRows(d.rows))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [campaignId, page, bucket])

  return (
    <>
      <CampaignSubnav campaignId={campaignId} />
    <Panel title="Campaign contacts" description="Eligibility uses the same engine as the dialer.">
      <div className="mb-4 flex flex-wrap gap-3">
        <SimpleSelect label="Eligibility" value={bucket} onChange={(v) => { setBucket(v); setPage(1) }} options={BUCKETS} />
        <Link href={`/app/power-dialer/campaigns/${campaignId}/history`} className="text-sm text-primary hover:underline self-end">History</Link>
        <Link href={`/app/power-dialer/campaigns/${campaignId}/analytics`} className="text-sm text-primary hover:underline self-end">Analytics</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 text-left" scope="col">Contact</th>
              <th className="px-2 py-2 text-left" scope="col">State</th>
              <th className="px-2 py-2 text-left" scope="col">Reason</th>
              <th className="px-2 py-2 text-left" scope="col">Attempts</th>
              <th className="px-2 py-2 text-left" scope="col">Latest</th>
              <th className="px-2 py-2 text-left" scope="col">Next callback</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-2 py-6 text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-muted-foreground">No contacts match this filter.</td></tr>}
            {rows.map((r) => (
              <tr key={r.contactId} className="border-b">
                <td className="px-2 py-2">
                  <span className="font-medium">{[r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unknown'}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{formatPhone(r.phone)}</span>
                </td>
                <td className="px-2 py-2"><StatusBadge tone="neutral">{r.bucket}</StatusBadge></td>
                <td className="px-2 py-2 text-xs">{r.reasonLabel}</td>
                <td className="px-2 py-2 tabular-nums">{r.attemptCount}</td>
                <td className="px-2 py-2 text-xs">{r.latestDisposition || r.latestStatus || '—'}</td>
                <td className="px-2 py-2 text-xs">{r.nextCallbackAt ? formatWhen(r.nextCallbackAt) : r.retryEligibleAt ? `Retry ${formatWhen(r.retryEligibleAt)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="text-sm text-primary disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <button type="button" className="text-sm text-primary" onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </Panel>
    </>
  )
}
