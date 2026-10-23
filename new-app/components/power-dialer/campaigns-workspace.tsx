'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { SimpleSelect } from '@/components/app/filters'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CampaignEditorSheet } from '@/components/power-dialer/campaign-editor-sheet'
import {
  clonePowerCampaign,
  fetchPowerCampaignTable,
  patchPowerCampaignAction,
  type PowerCampaignTableRow,
} from '@/lib/phone-api'
import { formatWhen } from '@/lib/format'

export function CampaignsWorkspace() {
  const [rows, setRows] = useState<PowerCampaignTableRow[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<PowerCampaignTableRow | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    void fetchPowerCampaignTable({ q, status })
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load campaigns'))
      .finally(() => setLoading(false))
  }, [q, status])

  useEffect(() => {
    reload()
  }, [reload])

  const filtered = useMemo(() => rows, [rows])

  const onClone = async (id: string) => {
    try {
      await clonePowerCampaign(id)
      toast.success('Campaign cloned')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Clone failed')
    }
  }

  const onArchive = async () => {
    if (!confirmArchive) return
    try {
      await patchPowerCampaignAction(confirmArchive.id, 'archive')
      toast.success('Campaign archived')
      setConfirmArchive(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Archive failed')
    }
  }

  return (
    <>
      <Panel
        title="Campaigns"
        description="Rules are enforced on the server — eligibility, caps, and schedules apply at dial time."
        actions={
          <Button size="sm" onClick={() => { setEditId(null); setEditorOpen(true) }}>
            <Plus />
            New campaign
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search campaigns"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search campaigns"
          />
          <SimpleSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'All (except archived)' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'draft', label: 'Draft' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium" scope="col">Name</th>
                <th className="px-3 py-2 font-medium" scope="col">Status</th>
                <th className="px-3 py-2 font-medium" scope="col">Contacts</th>
                <th className="px-3 py-2 font-medium" scope="col">Eligible</th>
                <th className="px-3 py-2 font-medium" scope="col">Attempts</th>
                <th className="px-3 py-2 font-medium" scope="col">Human conv.</th>
                <th className="px-3 py-2 font-medium" scope="col">Last activity</th>
                <th className="px-3 py-2 font-medium" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-3 py-8 text-muted-foreground" colSpan={8}>Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td className="px-3 py-8 text-muted-foreground" colSpan={8}>No campaigns yet.</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-3 py-3 font-medium">
                    <Link href={`/app/power-dialer/campaigns/${c.id}/contacts`} className="hover:text-primary">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.listName}</p>
                  </td>
                  <td className="px-3 py-3"><StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>{c.status}</StatusBadge></td>
                  <td className="px-3 py-3 tabular-nums">{c.totalContacts}{c.rollupTruncated ? '+' : ''}</td>
                  <td className="px-3 py-3 tabular-nums">{c.rollupTruncated ? '—' : c.eligible}</td>
                  <td className="px-3 py-3 tabular-nums">{c.attempts}</td>
                  <td className="px-3 py-3 tabular-nums">{c.humanConversations}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatWhen(c.lastActivity)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditId(c.id); setEditorOpen(true) }}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => void onClone(c.id)}>Clone</Button>
                      {c.status === 'active' ? (
                        <Button variant="ghost" size="sm" onClick={() => void patchPowerCampaignAction(c.id, 'pause').then(reload)}>Pause</Button>
                      ) : c.status !== 'archived' && c.status !== 'draft' ? (
                        <Button variant="ghost" size="sm" onClick={() => void patchPowerCampaignAction(c.id, 'resume').then(reload)}>Resume</Button>
                      ) : null}
                      <Link href={`/app/power-dialer/campaigns/${c.id}/history`} className="text-xs text-primary hover:underline self-center px-1">History</Link>
                      <Link href={`/app/power-dialer/campaigns/${c.id}/analytics`} className="text-xs text-primary hover:underline self-center px-1">Analytics</Link>
                      <Link href={`/app/power-dialer/dialer?campaign=${c.id}`} className="text-xs text-primary hover:underline self-center px-2">Dial</Link>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmArchive(c)} aria-label={`Archive ${c.name}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <CampaignEditorSheet
        open={editorOpen}
        campaignId={editId}
        onOpenChange={setEditorOpen}
        onSaved={() => { setEditorOpen(false); reload() }}
      />

      <Dialog open={!!confirmArchive} onOpenChange={() => setConfirmArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive campaign?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmArchive?.name} will be hidden from the default list. Historical attempts are preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchive(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void onArchive()}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
