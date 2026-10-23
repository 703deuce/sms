'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { useNumbers } from '@/components/providers/numbers-provider'

export function PowerDialerTeamSettingsPanel() {
  const { owned } = useNumbers()
  const [reps, setReps] = useState<{ userId: string; name: string; role: string }[]>([])
  const [repNumberAssignments, setRepNumberAssignments] = useState<Record<string, string[]>>({})
  const [assignments, setAssignments] = useState<
    { campaignId: string; campaignName: string; ownerUserId: string | null; memberUserIds: string[] }[]
  >([])
  const [visibility, setVisibility] = useState<'all_reps' | 'assigned_only'>('all_reps')

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/team')
      .then((r) => r.json())
      .then((j) => {
        setReps(j.data?.reps || [])
        setAssignments(j.data?.campaignAssignments || [])
        setVisibility(j.data?.settings?.teamActivityVisibility || 'all_reps')
        setRepNumberAssignments(j.data?.settings?.repNumberAssignments || {})
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveTeamSettings = async () => {
    const res = await fetch('/api/phone/power-dialer/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_team_settings',
        teamActivityVisibility: visibility,
        repNumberAssignments,
      }),
    })
    if (!res.ok) {
      toast.error('Could not save team settings')
      return
    }
    toast.success('Team visibility saved')
  }

  const saveCampaignMembers = async (campaignId: string, memberUserIds: string[]) => {
    const res = await fetch('/api/phone/power-dialer/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_campaign_access', campaignId, memberUserIds }),
    })
    if (!res.ok) {
      toast.error('Could not update campaign access')
      return
    }
    toast.success('Campaign access updated')
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Activity visibility">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Reps can see</span>
          <select
            className="max-w-xs rounded-md border bg-background px-3 py-2"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'all_reps' | 'assigned_only')}
          >
            <option value="all_reps">All workspace dialing activity</option>
            <option value="assigned_only">Only their assigned campaigns</option>
          </select>
        </label>
        <Button type="button" size="sm" className="mt-3" onClick={() => void saveTeamSettings()}>Save visibility</Button>
      </Panel>
      <Panel title="Rep caller ID assignments (P21 / P28)">
        <p className="mb-3 text-sm text-muted-foreground">
          Restrict which owned numbers each rep may use at dial origination. Manage inventory under Numbers.
        </p>
        <ul className="space-y-4 text-sm">
          {reps.map((r) => (
            <li key={r.userId} className="rounded border p-3">
              <p className="font-medium">{r.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {owned.filter((n) => n.status === 'active').map((n) => {
                  const checked = (repNumberAssignments[r.userId] || []).includes(n.id)
                  return (
                    <label key={n.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setRepNumberAssignments((prev) => {
                            const cur = prev[r.userId] || []
                            const next = e.target.checked
                              ? [...new Set([...cur, n.id])]
                              : cur.filter((id) => id !== n.id)
                            return { ...prev, [r.userId]: next }
                          })
                        }}
                      />
                      {n.nickname || n.number}
                    </label>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
        <Button type="button" size="sm" className="mt-3" onClick={() => void saveTeamSettings()}>Save rep number assignments</Button>
      </Panel>
      <Panel title="Campaign access">
        <ul className="divide-y text-sm">
          {assignments.map((a) => (
            <li key={a.campaignId} className="py-3">
              <p className="font-medium">{a.campaignName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {reps.map((r) => {
                  const checked = a.memberUserIds.includes(r.userId) || a.ownerUserId === r.userId
                  return (
                    <label key={r.userId} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...new Set([...a.memberUserIds, r.userId])]
                            : a.memberUserIds.filter((id) => id !== r.userId)
                          void saveCampaignMembers(a.campaignId, next)
                        }}
                      />
                      {r.name} ({r.role})
                    </label>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
