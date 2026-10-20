'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel } from '@/components/app/page-primitives'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveForwardingGroup, type ForwardingConfigDto } from '@/lib/phone-forwarding-api'

type Props = {
  config: ForwardingConfigDto
  phoneNumberId: string
  onSaved: () => void
}

export function ForwardingRingGroups({ config, phoneNumberId, onSaved }: Props) {
  const [name, setName] = useState('Main ring group')
  const [strategy, setStrategy] = useState<'sequential' | 'simultaneous'>('sequential')
  const [memberIds, setMemberIds] = useState<string[]>([])

  const activeGroup = config.groups[0]

  const move = (index: number, dir: -1 | 1) => {
    const next = [...memberIds]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setMemberIds(next)
  }

  const saveGroup = () => {
    if (!memberIds.length) {
      toast.error('Select at least one destination')
      return
    }
    void saveForwardingGroup({
      id: activeGroup?.id,
      name,
      strategy,
      memberDestinationIds: memberIds,
    })
      .then(() => {
        toast.success('Ring group saved')
        onSaved()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save group'))
  }

  const assignGroup = () => {
    if (!activeGroup?.id) {
      toast.error('Save a ring group first')
      return
    }
    void fetch('/api/phone/forwarding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId,
        answeringMode: 'forward',
        forwardingGroupId: activeGroup.id,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Assign failed')
        toast.success('This number will ring the group')
        onSaved()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
  }

  return (
    <Panel
      title="Ring strategy"
      description="Ring multiple destinations together or in order. Drag-style reorder uses move up/down."
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rg-name">Group name</Label>
            <Input id="rg-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rg-strategy">Strategy</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as 'sequential' | 'simultaneous')}>
              <SelectTrigger id="rg-strategy" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Ring in order</SelectItem>
                <SelectItem value="simultaneous">Ring all at once</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {strategy === 'simultaneous' && (
          <p className="text-xs text-muted-foreground">
            Each external line is dialed separately. The first destination to accept wins; other attempts are canceled.
          </p>
        )}
        <div>
          <Label>Destinations in group</Label>
          <ul className="mt-2 flex flex-col gap-2">
            {config.destinations.map((d) => {
              const checked = memberIds.includes(d.id)
              return (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setMemberIds((ids) =>
                        checked ? ids.filter((x) => x !== d.id) : [...ids, d.id],
                      )
                    }
                    aria-label={`Include ${d.name}`}
                  />
                  <span className="flex-1 text-sm">{d.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {d.displayNumber || d.phoneE164}
                  </span>
                  {checked && (
                    <span className="flex gap-1">
                      <Button type="button" size="icon" variant="ghost" aria-label="Move up" onClick={() => move(memberIds.indexOf(d.id), -1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label="Move down" onClick={() => move(memberIds.indexOf(d.id), 1)}>
                        <ArrowDown className="size-4" />
                      </Button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={saveGroup}>
            <Plus className="size-4" />
            Save ring group
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={assignGroup}>
            Use for selected number
          </Button>
        </div>
      </div>
    </Panel>
  )
}
