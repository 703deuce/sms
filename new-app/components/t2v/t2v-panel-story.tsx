'use client'

import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'

export function T2vPanelStory({
  doc,
  sceneId,
  onChange,
}: {
  doc: T2vDraftV1
  sceneId: string | null
  onChange: (next: T2vDraftV1) => void
}) {
  const idx = doc.scenes.findIndex((s) => s.id === sceneId)
  const scene = idx >= 0 ? doc.scenes[idx] : null

  const patchScene = (patch: Partial<T2vScene>) => {
    if (idx < 0) return
    const scenes = [...doc.scenes]
    scenes[idx] = { ...scenes[idx], ...patch }
    onChange({ ...doc, scenes })
  }

  if (!scene) {
    return <p className="p-4 text-sm text-muted-foreground">Select a scene in the strip below.</p>
  }

  return (
    <div className="space-y-4 p-4">
      <header className="text-sm font-medium">Scene {idx + 1} of {doc.scenes.length}</header>
      <div>
        <Label>Narration</Label>
        <Textarea className="mt-1" rows={4} value={scene.narration} onChange={(e) => patchScene({ narration: e.target.value })} />
        <p className="mt-1 text-xs text-muted-foreground">
          Voice {scene.voice?.status ?? 'pending'} · {(estimateSceneMs(scene) / 1000).toFixed(1)}s
        </p>
      </div>
      <div>
        <Label>On-screen text</Label>
        <Input className="mt-1" value={scene.onScreenText ?? ''} onChange={(e) => patchScene({ onScreenText: e.target.value })} />
      </div>
      <div>
        <Label>Visual query</Label>
        <Input className="mt-1" value={scene.visualQuery} onChange={(e) => patchScene({ visualQuery: e.target.value })} />
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        <p className="text-xs font-medium text-muted-foreground">All scenes</p>
        {doc.scenes.map((s, i) => (
          <p key={s.id} className={cnText(s.id === sceneId)}>{i + 1}. {s.narration.slice(0, 48)}…</p>
        ))}
      </div>
    </div>
  )
}

function cnText(active: boolean) {
  return `text-xs ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`
}
