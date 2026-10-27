'use client'

import { useMemo, useState } from 'react'
import { createId } from '@/lib/supabase/id'
import type { T2vDraftV1, T2vTextItem } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function clampItem(item: T2vTextItem, sceneDurMs: number): T2vTextItem {
  const max = Math.max(500, sceneDurMs)
  let startMs = Math.max(0, Math.min(item.startMs, max - 200))
  let endMs = Math.max(startMs + 200, Math.min(item.endMs, max))
  if (endMs > max) endMs = max
  if (startMs >= endMs) startMs = Math.max(0, endMs - 200)
  return { ...item, startMs, endMs }
}

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
  const sceneDurMs = useMemo(() => (scene ? estimateSceneMs(scene) : 5000), [scene])

  const updateTexts = (texts: T2vTextItem[]) => {
    if (sceneIdx < 0) return
    const scenes = [...doc.scenes]
    scenes[sceneIdx] = {
      ...scenes[sceneIdx],
      texts: texts.map((t) => clampItem(t, sceneDurMs)),
    }
    onChange({ ...doc, scenes })
  }

  const addItem = (kind: T2vTextItem['kind']) => {
    if (kind === 'title') {
      const existing = scene.texts.find((t) => t.kind === 'title')
      if (existing) {
        updateTexts(
          scene.texts.map((t) =>
            t.id === existing.id ? { ...t, text: t.text.trim() || scene.onScreenText || 'Title' } : t,
          ),
        )
        return
      }
    }
    const item: T2vTextItem = clampItem(
      {
        id: createId('tx'),
        kind,
        text: kind === 'title' ? 'Title' : 'Name',
        subtitle: kind === 'lower_third' ? 'Subtitle' : undefined,
        startMs: 0,
        endMs: Math.min(2500, sceneDurMs),
        animation: 'fade',
      },
      sceneDurMs,
    )
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
        <p className="mt-1 text-xs text-muted-foreground">Scene length ~{(sceneDurMs / 1000).toFixed(1)}s</p>
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
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Start {(t.startMs / 1000).toFixed(2)}s</span>
                <span>End {(t.endMs / 1000).toFixed(2)}s</span>
              </div>
              <Label className="text-xs">Start (ms)</Label>
              <Slider
                min={0}
                max={Math.max(200, sceneDurMs - 200)}
                step={50}
                value={[t.startMs]}
                onValueChange={(vals) => {
                  const startMs = (Array.isArray(vals) ? vals[0] : vals) ?? 0
                  const endMs = Math.max(startMs + 200, t.endMs)
                  updateTexts(
                    scene.texts.map((x) =>
                      x.id === t.id ? clampItem({ ...x, startMs, endMs }, sceneDurMs) : x,
                    ),
                  )
                }}
              />
              <Label className="text-xs">End (ms)</Label>
              <Slider
                min={200}
                max={sceneDurMs}
                step={50}
                value={[t.endMs]}
                onValueChange={(vals) => {
                  const endMs = (Array.isArray(vals) ? vals[0] : vals) ?? t.endMs
                  updateTexts(
                    scene.texts.map((x) =>
                      x.id === t.id ? clampItem({ ...x, endMs }, sceneDurMs) : x,
                    ),
                  )
                }}
              />
            </div>
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
