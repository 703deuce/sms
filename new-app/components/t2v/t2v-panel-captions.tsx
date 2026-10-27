'use client'

import { CaptionPresetPicker } from '@/components/clips/caption-preset-picker'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function T2vPanelCaptions({
  doc,
  onChange,
}: {
  doc: T2vDraftV1
  onChange: (next: T2vDraftV1) => void
}) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="t2v-captions">Captions on export</Label>
        <Switch
          id="t2v-captions"
          checked={doc.settings.captionsEnabled}
          onCheckedChange={(on) => onChange({ ...doc, settings: { ...doc.settings, captionsEnabled: on } })}
        />
      </div>
      <CaptionPresetPicker
        value={doc.settings.captionPresetId ?? 'classic'}
        onChange={(presetId) =>
          onChange({ ...doc, settings: { ...doc.settings, captionPresetId: presetId } })
        }
      />
    </div>
  )
}
