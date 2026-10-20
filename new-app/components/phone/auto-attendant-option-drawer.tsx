'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export type MenuOptionDraft = {
  digit: string
  label: string
  actionType: string
  actionConfigJson: Record<string, unknown>
}

const ACTION_TYPES = [
  { value: 'forward_phone', label: 'Forward to phone' },
  { value: 'ring_group', label: 'Forward to ring group' },
  { value: 'open_menu', label: 'Open another menu' },
  { value: 'voicemail', label: 'Business voicemail' },
  { value: 'announcement', label: 'Play announcement' },
  { value: 'hangup', label: 'End call' },
]

type Props = {
  open: boolean
  option: MenuOptionDraft | null
  destinations: Array<{ id: string; name: string; phoneE164: string }>
  groups: Array<{ id: string; name: string }>
  menus: Array<{ id: string; name: string }>
  onClose: () => void
  onSave: (option: MenuOptionDraft) => void
}

export function AutoAttendantOptionDrawer({
  open,
  option,
  destinations,
  groups,
  menus,
  onClose,
  onSave,
}: Props) {
  if (!option) return null
  const cfg = option.actionConfigJson

  const patchCfg = (patch: Record<string, unknown>) => {
    onSave({ ...option, actionConfigJson: { ...cfg, ...patch } })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full max-w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configure option {option.digit}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <div>
            <Label htmlFor="opt-digit">Keypad digit</Label>
            <Input
              id="opt-digit"
              className="mt-1 w-20"
              maxLength={1}
              value={option.digit}
              onChange={(e) => onSave({ ...option, digit: e.target.value.replace(/\D/g, '').slice(0, 1) })}
            />
          </div>
          <div>
            <Label htmlFor="opt-label">Label</Label>
            <Input
              id="opt-label"
              className="mt-1"
              value={option.label}
              onChange={(e) => onSave({ ...option, label: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="opt-action">Action</Label>
            <Select value={option.actionType} onValueChange={(v) => onSave({ ...option, actionType: v, actionConfigJson: {} })}>
              <SelectTrigger id="opt-action" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {option.actionType === 'forward_phone' && (
            <>
              <div>
                <Label>Saved destination</Label>
                <Select
                  value={String(cfg.destinationId || '')}
                  onValueChange={(id) => {
                    const d = destinations.find((x) => x.id === id)
                    patchCfg({ destinationId: id, destinationE164: d?.phoneE164 })
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} · {d.phoneE164}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={cfg.press1 !== false}
                  onCheckedChange={(v) => patchCfg({ press1: v })}
                  aria-label="Press 1 to accept"
                />
                <span className="text-sm">Require Press 1 to accept</span>
              </div>
            </>
          )}

          {option.actionType === 'ring_group' && (
            <div>
              <Label>Ring group</Label>
              <Select value={String(cfg.groupId || '')} onValueChange={(id) => patchCfg({ groupId: id })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {option.actionType === 'open_menu' && (
            <div>
              <Label>Nested menu</Label>
              <Select value={String(cfg.menuId || '')} onValueChange={(id) => patchCfg({ menuId: id })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose menu" />
                </SelectTrigger>
                <SelectContent>
                  {menus.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Nested depth is limited to 3 levels.</p>
            </div>
          )}

          {option.actionType === 'announcement' && (
            <>
              <div>
                <Label htmlFor="ann-text">Announcement</Label>
                <Input
                  id="ann-text"
                  className="mt-1"
                  value={String(cfg.text || '')}
                  onChange={(e) => patchCfg({ text: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={() => { onSave(option); onClose() }}>Save option</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
