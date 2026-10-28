'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ClipLengthChoice } from '@/components/clips/clip-length-choice'
import {
  clipLengthChoiceFromSettings,
  streamerClipLengthFields,
  type ClipLengthChoice,
} from '@/lib/clips/clip-length'
import { clipsFetch } from '@/lib/clips-api'
import { PrimaryButton } from '@/components/app/primary-button'

export function ChannelClipLengthSettings({
  channelId,
  initialSettings,
}: {
  channelId: string
  initialSettings: unknown
}) {
  const initial = clipLengthChoiceFromSettings(
    (typeof initialSettings === 'object' && initialSettings ? initialSettings : {}) as {
      clipLenMode?: 'auto' | 'target'
      targetClipLenS?: number | null
    },
  )
  const [choice, setChoice] = useState<ClipLengthChoice>(initial)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await clipsFetch(`/api/streamer/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ settings: streamerClipLengthFields(choice) }),
      })
      toast.success('Clip length saved for auto-imports')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <ClipLengthChoice value={choice} onChange={setChoice} />
      <PrimaryButton type="button" size="sm" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save clip length'}
      </PrimaryButton>
    </div>
  )
}
