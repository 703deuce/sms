'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export function ScriptMulticamPanel({
  document,
  onPatchSettings,
  onAutoMulticam,
  sceneCount,
}: {
  document: ScriptDocumentV1
  onPatchSettings: (patch: Partial<NonNullable<ScriptDocumentV1['settings']>>) => void
  onAutoMulticam: () => void
  sceneCount: number
}) {
  const mc = document.settings?.multicam
  return (
    <div className="flex flex-col gap-3 p-3 text-sm" data-testid="script-multicam-panel">
      <div className="flex items-center justify-between">
        <Label className="text-[13px] font-semibold">Automatic multicam</Label>
        <Switch
          checked={mc?.enabled ?? false}
          onCheckedChange={(enabled) =>
            onPatchSettings({
              multicam: {
                enabled,
                minHoldMs: mc?.minHoldMs ?? 2000,
                wideEveryMs: mc?.wideEveryMs ?? 45_000,
              },
            })
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Active-speaker scenes from diarization. {sceneCount} scene{sceneCount === 1 ? '' : 's'} in composition.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onAutoMulticam}>
        Generate camera cuts
      </Button>
    </div>
  )
}
