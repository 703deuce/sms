'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClipUserStreamerChannelRow } from '@/lib/clips/clip-export-user-types'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

export function ExportSavedChannelsField({
  platform,
  channelUrl,
  savedChannels,
  onSelectUrl,
  onChannelsChange,
}: {
  platform?: 'twitch' | 'kick'
  channelUrl: string
  savedChannels: ClipUserStreamerChannelRow[]
  onSelectUrl: (url: string) => void
  onChannelsChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const filtered = savedChannels.filter((c) => !platform || c.platform === platform)

  const saveCurrent = async () => {
    const url = channelUrl.trim()
    if (!url || !platform) {
      toast.error('Enter a channel URL first')
      return
    }
    setBusy(true)
    try {
      await clipsFetch('/api/clips/my-channels', {
        method: 'POST',
        body: JSON.stringify({ platform, url }),
      })
      onChannelsChange()
      toast.success('Saved to My channels')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save channel')
    } finally {
      setBusy(false)
    }
  }

  if (!filtered.length && !platform) return null

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">My channels</Label>
      {filtered.length > 0 ? (
        <Select
          value=""
          onValueChange={(id) => {
            const row = filtered.find((c) => c.id === id)
            if (row) onSelectUrl(row.url)
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Pick a saved channel link" />
          </SelectTrigger>
          <SelectContent>
            {filtered.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label || c.url}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">No saved channels yet.</p>
      )}
      {platform ? (
        <Button type="button" size="sm" variant="outline" disabled={busy || !channelUrl.trim()} onClick={() => void saveCurrent()}>
          Save current link
        </Button>
      ) : null}
    </div>
  )
}
