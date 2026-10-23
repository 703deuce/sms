'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/app/page-primitives'
import { CampaignSubnav } from '@/components/power-dialer/campaign-subnav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/app/status'

type QueueRow = {
  memberId: string
  contactId: string
  name: string
  phone: string
  dialPriority: number
  queueSortOrder: number | null
  eligible: boolean
  bucket: string
  reasonLabel: string
}

export function CampaignQueueContent({ campaignId }: { campaignId: string }) {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [dialOrder, setDialOrder] = useState('fifo')
  const [loading, setLoading] = useState(true)

  const reload = () => {
    setLoading(true)
    void fetch(`/api/phone/power-dialer/campaigns/${campaignId}/queue`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data?.rows || [])
        setDialOrder(j.data?.dialOrder || 'fifo')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [campaignId])

  const patch = async (body: Record<string, unknown>) => {
    try {
      const r = await fetch(`/api/phone/power-dialer/campaigns/${campaignId}/queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Update failed')
      reload()
      toast.success('Queue updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const moveUp = (idx: number) => {
    if (idx <= 0) return
    const reorder = rows.map((r, i) => ({
      contactId: r.contactId,
      queueSortOrder: i === idx ? idx - 1 : i === idx - 1 ? idx : i,
    }))
    void patch({ reorder })
  }

  return (
    <>
      <CampaignSubnav campaignId={campaignId} />
      <Panel title="Dial queue" description={`Server order: ${dialOrder}. Eligibility reasons match the dialer engine.`}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading queue…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts on this campaign list.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-2 py-2 text-left" scope="col">#</th>
                <th className="px-2 py-2 text-left" scope="col">Contact</th>
                <th className="px-2 py-2 text-left" scope="col">Priority</th>
                <th className="px-2 py-2 text-left" scope="col">Eligible</th>
                <th className="px-2 py-2 text-left" scope="col">Reason</th>
                <th className="px-2 py-2 text-left" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.contactId} className="border-b">
                  <td className="px-2 py-2 tabular-nums">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{r.phone}</span>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      className="h-8 w-20"
                      value={r.dialPriority}
                      aria-label={`Priority for ${r.name}`}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setRows((prev) => prev.map((x) => (x.contactId === r.contactId ? { ...x, dialPriority: v } : x)))
                      }}
                      onBlur={() =>
                        void patch({ setPriority: [{ contactId: r.contactId, dialPriority: r.dialPriority }] })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge tone={r.eligible ? 'success' : 'neutral'}>{r.bucket}</StatusBadge>
                  </td>
                  <td className="px-2 py-2 text-xs">{r.reasonLabel}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => moveUp(idx)} disabled={idx === 0}>
                        Up
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void patch({ skipContactId: r.contactId })}>
                        Skip
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}
