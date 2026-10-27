'use client'

import { useState } from 'react'
import { createId } from '@/lib/supabase/id'
import type { T2vDraftV1, T2vTextItem } from '@/lib/t2v/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function T2vPanelText({
  doc,
  onChange,
}: {
  doc: T2vDraftV1
  onChange: (next: T2vDraftV1) => void
}) {
  const [sceneId, setSceneId] = useState(doc.scenes[0]?.id ?? '')
  const sceneIdx = doc.scenes.findIndex((s) => s.id === sceneId)
  const scene = sceneIdx >= 0 ? doc.scenes[sceneIdx] : null

  const updateTexts = (texts: T2vTextItem[]) => {
    if (sceneIdx < 0) return
    const scenes = [...doc.scenes]
    scenes[sceneIdx] = { ...scenes[sceneIdx], texts }
    onChange({ ...doc, scenes })
  }

  const addItem = (kind: T2vTextItem['kind']) => {
    const item: T2vTextItem = {
      id: createId('tx'),
      kind,
      text: kind === 'title' ? 'Title' : 'Name',
      subtitle: kind === 'lower_third' ? 'Subtitle' : undefined,
      startMs: 0,
      endMs: 2500,
      animation: 'fade',
    }
    updateTexts([...(scene?.texts ?? []), item])
  }

  if (!scene) {
    return <p className="p-4 text-sm text-muted-foreground">Add scenes before editing titles.</p>
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <Label>Scene</Label>
        <Select value={sceneId} onValueChange={(v) => v && setSceneId(v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {doc.scenes.map((s, i) => (
              <SelectItem key={s.id} value={s.id}>Scene {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => addItem('title')}>+ Title</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => addItem('lower_third')}>+ Lower third</Button>
      </div>
      <ul className="space-y-3">
        {scene.texts.map((t) => (
          <li key={t.id} className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs uppercase text-muted-foreground">{t.kind.replace('_', ' ')}</p>
            <Input
              value={t.text}
              onChange={(e) =>
                updateTexts(scene.texts.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)))
              }
            />
            {t.kind === 'lower_third' ? (
              <Input
                placeholder="Subtitle"
                value={t.subtitle ?? ''}
                onChange={(e) =>
                  updateTexts(scene.texts.map((x) => (x.id === t.id ? { ...x, subtitle: e.target.value } : x)))
                }
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => updateTexts(scene.texts.filter((x) => x.id !== t.id))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
