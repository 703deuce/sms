'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  T6_TEMPLATES_BY_ID,
  templateInFamily,
  templatesForFamily,
  type TemplateLane,
} from '@/lib/clips/templates/registry'
import { pickTemplate } from '@/lib/clips/templates/pick'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'
import { t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { TemplateStage } from '@/components/clips/editor/template-stage'
import { resolveTemplateGeometry } from '@/lib/clips/templates/geometry'
import { templateLayoutPatch } from '@/lib/clips/editor/starter-templates'

const LANES: TemplateLane[] = ['gaming', 'irl', 'just_chatting', 'podcast']

export function TemplateLayoutPanel({
  edits,
  onEdits,
  aiMeta,
  videoUrl,
  posterUrl,
}: {
  edits: ClipEditsV2
  onEdits: (e: ClipEditsV2) => void
  aiMeta?: Record<string, unknown> | null
  videoUrl?: string | null
  posterUrl?: string | null
}) {
  // T6.3: the family dropdown only browses; it used to call applyTemplate(<current id>) and
  // ignore the chosen value, so the lane (derived from the current template) never changed.
  const [browseLane, setBrowseLane] = useState<TemplateLane | null>(null)
  if (!t6TemplatesEnabled()) return null
  const signals = signalsOrDefaults(aiMeta)
  const activeTpl = edits.layout.template?.id ? T6_TEMPLATES_BY_ID[edits.layout.template.id] : undefined
  const storedLane = edits.layout.template?.lane as TemplateLane | undefined
  // T6.4: a shared template (e.g. C2 picked from Podcast) keeps the family it was picked from.
  const currentLane: TemplateLane =
    (activeTpl && storedLane && templateInFamily(activeTpl, storedLane) ? storedLane : activeTpl?.lane) ??
    storedLane ??
    ((LANES as string[]).includes(signals.clip_type) ? (signals.clip_type as TemplateLane) : 'irl')
  const lane: TemplateLane = browseLane ?? currentLane
  // T6.4: families share face layouts (Podcast lists C7-C9 plus the shared C1-C6).
  const laneTemplates = templatesForFamily(lane)

  const applyTemplate = (id: string, auto: boolean, reason?: string, family?: string) => {
    const t = T6_TEMPLATES_BY_ID[id]
    if (!t) return
    // E4: shared with the Templates picker (identical edits from both places).
    onEdits(templateLayoutPatch(edits, t, { auto, reason, family }))
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template</Label>
        <Select value={lane} onValueChange={(v) => setBrowseLane((LANES as string[]).includes(v) ? (v as TemplateLane) : null)}>
          <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="template-family">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANES.map((l) => (
              <SelectItem key={l} value={l} data-testid={`template-family-${l}`}>
                {l.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {laneTemplates.map((t) => {
          const spec = resolveTemplateGeometry(t, signals, edits, 1080, 1920)
          const active = edits.layout.template?.id === t.id
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`template-tile-${t.id}`}
              data-active={active ? 'true' : 'false'}
              className={`relative overflow-hidden rounded-md border ${active ? 'ring-2 ring-primary' : 'opacity-90'}`}
              onClick={() => {
                applyTemplate(t.id, false, 'user_pick', lane)
                setBrowseLane(null)
              }}
            >
              <div className="h-[72px] w-full bg-black">
                {/* T6.2: static poster thumbnails — N live <video>s starved the main preview. */}
                <TemplateStage spec={spec} videoUrl={videoUrl} posterUrl={posterUrl} staticPoster />
              </div>
              <span className="block bg-muted/40 px-1 py-0.5 text-[10px] font-medium">
                {t.id} · {t.name}
              </span>
            </button>
          )
        })}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => {
          const [id, reason] = pickTemplate(signals, {}, [], {}, 1, edits.layout.template?.id ?? 'clip')
          applyTemplate(id, true, reason, signals.clip_type)
          setBrowseLane(null)
        }}
      >
        Auto template
      </Button>
    </div>
  )
}
