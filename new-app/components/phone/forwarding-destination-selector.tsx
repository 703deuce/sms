'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type WorkspaceNumberOption = {
  id: string
  e164: string
  friendlyName: string | null
}

export type ForwardingDestinationSelectorValue =
  | { mode: 'external_phone'; label: string; phoneE164: string }
  | { mode: 'workspace_number'; label: string; workspacePhoneNumberId: string }

type Props = {
  workspaceNumbers: WorkspaceNumberOption[]
  value: ForwardingDestinationSelectorValue | null
  onChange: (value: ForwardingDestinationSelectorValue) => void
  defaultTab?: 'external_phone' | 'workspace_number'
  labelName?: string
  labelPhone?: string
}

export function ForwardingDestinationSelector({
  workspaceNumbers,
  value,
  onChange,
  defaultTab = 'external_phone',
  labelName = 'Destination name',
  labelPhone = 'Phone number',
}: Props) {
  const tab =
    value?.mode === 'workspace_number' ? 'workspace_number' : defaultTab
  const [activeTab, setActiveTab] = useState<'external_phone' | 'workspace_number'>(tab)

  const name = value?.label ?? ''
  const externalPhone = value?.mode === 'external_phone' ? value.phoneE164 : ''
  const workspaceId =
    value?.mode === 'workspace_number' ? value.workspacePhoneNumberId : ''

  const sortedNumbers = useMemo(
    () =>
      [...workspaceNumbers].sort((a, b) =>
        (a.friendlyName || a.e164).localeCompare(b.friendlyName || b.e164),
      ),
    [workspaceNumbers],
  )

  const patch = (next: Partial<ForwardingDestinationSelectorValue> & { mode: ForwardingDestinationSelectorValue['mode'] }) => {
    if (next.mode === 'external_phone') {
      onChange({
        mode: 'external_phone',
        label: next.label ?? name,
        phoneE164: next.phoneE164 ?? externalPhone,
      })
      return
    }
    onChange({
      mode: 'workspace_number',
      label: next.label ?? name,
      workspacePhoneNumberId: next.workspacePhoneNumberId ?? workspaceId,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const mode = v as 'external_phone' | 'workspace_number'
          setActiveTab(mode)
          if (mode === 'external_phone') {
            patch({ mode: 'external_phone', phoneE164: externalPhone })
          } else {
            patch({
              mode: 'workspace_number',
              workspacePhoneNumberId: workspaceId || sortedNumbers[0]?.id || '',
            })
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="external_phone">Enter a phone number</TabsTrigger>
          <TabsTrigger value="workspace_number">Choose a Transovo number</TabsTrigger>
        </TabsList>
        <TabsContent value="external_phone" className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Use any supported external cellphone, office phone, or landline.
          </p>
          <div>
            <Label htmlFor="fwd-dest-name">{labelName}</Label>
            <Input
              id="fwd-dest-name"
              className="mt-1"
              value={activeTab === 'external_phone' ? name : ''}
              onChange={(e) => patch({ mode: 'external_phone', label: e.target.value })}
              placeholder="Owner cellphone"
            />
          </div>
          <div>
            <Label htmlFor="fwd-dest-phone">{labelPhone}</Label>
            <Input
              id="fwd-dest-phone"
              className="mt-1 font-mono"
              value={activeTab === 'external_phone' ? externalPhone : ''}
              onChange={(e) => patch({ mode: 'external_phone', phoneE164: e.target.value })}
              placeholder="+1…"
            />
          </div>
        </TabsContent>
        <TabsContent value="workspace_number" className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Choose an existing number from your account. Looping forwards are blocked.
          </p>
          <div>
            <Label htmlFor="fwd-ws-name">{labelName}</Label>
            <Input
              id="fwd-ws-name"
              className="mt-1"
              value={activeTab === 'workspace_number' ? name : ''}
              onChange={(e) => patch({ mode: 'workspace_number', label: e.target.value })}
              placeholder="Sales line"
            />
          </div>
          <div>
            <Label>Transovo number</Label>
            <Select
              value={activeTab === 'workspace_number' ? workspaceId : undefined}
              onValueChange={(id) => {
                const n = sortedNumbers.find((x) => x.id === id)
                patch({
                  mode: 'workspace_number',
                  workspacePhoneNumberId: id,
                  label: name || n?.friendlyName || 'Transovo number',
                })
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select number" />
              </SelectTrigger>
              <SelectContent>
                {sortedNumbers.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.friendlyName ? `${n.friendlyName} · ` : ''}
                    <span className="font-mono">{n.e164}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
