'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { clipsFetch } from '@/lib/clips-api'

export function ChannelAutoProcessToggle({
  channelId,
  connected,
  initial,
  rollingEnabled = false,
  platform = 'twitch',
}: {
  channelId: string
  connected: boolean
  initial: boolean
  rollingEnabled?: boolean
  platform?: string
}) {
  const [checked, setChecked] = useState(initial)
  const [busy, setBusy] = useState(false)

  const onChange = async (next: boolean) => {
    if (!connected || busy) return
    setBusy(true)
    try {
      await clipsFetch(`/api/streamer/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ autoProcess: next }),
      })
      setChecked(next)
      toast.success(
        next
          ? platform === 'twitch' && rollingEnabled
            ? 'Live follow on — auto-clip while live and after stream ends'
            : 'Auto-import enabled when stream ends'
          : 'Auto-import off',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update channel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={checked}
          disabled={!connected || busy}
          onCheckedChange={(v) => void onChange(v === true)}
        />
        <Label className="font-normal">
          {platform === 'twitch' && rollingEnabled
            ? 'Follow live & auto-clip'
            : 'Auto-import VOD when stream ends'}
        </Label>
      </label>
      <p className="text-xs text-muted-foreground pl-6">
        {platform === 'twitch' && rollingEnabled
          ? 'EventSub while connected: pulls new archive minutes during the stream, then a final pass when you go offline.'
          : 'Waits for the platform VOD, then queues the same highlight pipeline as a pasted link (not live clipping).'}
      </p>
    </div>
  )
}
