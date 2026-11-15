'use client'

import { ArrowRight, Info, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  MS_DIRECTIONS,
  MS_LABELS,
  MS_LENGTHS,
  MS_PRODUCTION_MODES,
  MS_VOICEOVER,
  selectedWorkflowLine,
} from '@/lib/motion-studio/config'
import type { MsMusicChoice, MsProject, MsSettings } from '@/lib/motion-studio/types'
import { AllowancePanel } from './allowance-panel'

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  testId,
  disabled,
}: {
  label: string
  value: T
  options: { value: T; label: string; badge?: string }[]
  onChange: (v: T) => void
  testId: string
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[200px_1fr] sm:items-center" data-testid={testId}>
      <p className="text-sm font-medium" id={`${testId}-label`}>{label}</p>
      <div role="radiogroup" aria-labelledby={`${testId}-label`} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                active ? 'border-primary/60 bg-primary/10 font-medium text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-surface-raised hover:text-foreground',
              )}
            >
              {o.label}
              {o.badge ? <Badge variant="beta" className="h-4 px-1 text-[11px]">{o.badge}</Badge> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Current music choice: explicit setting, else inferred from the allowance line the backend returns. */
export function musicChoiceOf(project: MsProject): MsMusicChoice {
  if (project.settings.music) return project.settings.music
  const item = project.allowance?.items.find((i) => i.id === 'music')
  if (item?.thirdParty) return 'elevenlabs'
  if (/your music/i.test(item?.label ?? '') || project.audio?.music?.source === 'upload') return 'upload'
  if (/^no music/i.test(item?.label ?? '')) return 'none'
  return 'generated'
}

/** Second screen (concept §2): the production settings, then planning. */
export function SetupStep({
  project,
  busy,
  onChange,
  onPlan,
}: {
  project: MsProject
  busy: string | null
  onChange: (patch: Partial<MsSettings>) => void
  onPlan: () => void
}) {
  const s = project.settings
  const music = musicChoiceOf(project)
  const hasMusicUpload = project.assets.some((a) => a.role === 'music') || music === 'upload'
  const musicOptions: { value: MsMusicChoice; label: string; badge?: string }[] = [
    { value: 'generated', label: 'Generated score' },
    ...(hasMusicUpload ? [{ value: 'upload' as const, label: 'My music' }] : []),
    { value: 'elevenlabs', label: 'Premium score', badge: 'Optional' },
    { value: 'none', label: 'No music' },
  ]
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8" data-testid="ms-setup">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">Project setup</p>
        <p className="text-sm text-muted-foreground">{selectedWorkflowLine(project.workflow, { lengthMin: s.lengthMin, uploads: project.assets.length })}</p>
      </div>
      <section className="rounded-xl border border-border bg-card px-5 shadow-xs" aria-label="Production settings">
        <div className="divide-y divide-border/70">
          <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[200px_1fr] sm:items-center" data-testid="ms-setting-length">
            <label htmlFor="ms-length-minutes" className="text-sm font-medium">{MS_LABELS.length}</label>
            <div className="flex flex-wrap items-center gap-2">
              <input id="ms-length-minutes" type="number" inputMode="numeric" min={1} max={35791} step={1}
                aria-label="Documentary length in minutes" value={s.lengthMin}
                onChange={(e) => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n >= 1 && n <= 35791) onChange({ lengthMin: n }) }}
                className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm" />
              <span className="text-xs text-muted-foreground">minutes · any positive whole number</span>
              {MS_LENGTHS.map((l) => (
                <button key={l.value} type="button" onClick={() => onChange({ lengthMin: l.value })}
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-raised">
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <Segmented testId="ms-setting-direction" label={MS_LABELS.visualDirection} value={s.visualDirection} options={MS_DIRECTIONS} onChange={(v) => onChange({ visualDirection: v })} />
          <Segmented testId="ms-setting-voiceover" label={MS_LABELS.voiceover} value={s.voiceover} options={MS_VOICEOVER} onChange={(v) => onChange({ voiceover: v })} />
          <div>
            <Segmented testId="ms-setting-music" label="Music" value={music} options={musicOptions} onChange={(v) => onChange({ music: v })} />
            {music === 'elevenlabs' ? (
              <p className="-mt-2 pb-4 text-xs text-muted-foreground sm:pl-[208px]" data-testid="ms-music-premium-note">
                One premium generation per project and length, reused when the film is re-assembled. It never retries automatically and falls back to the generated score if unavailable. Included while charging is off.
              </p>
            ) : null}
          </div>
          <Segmented
            testId="ms-setting-format"
            label={MS_LABELS.format}
            value={s.renderSize || '480p'}
            options={[
              { value: '480p', label: '16:9 · 480p' },
              { value: '720p', label: '16:9 · 720p' },
              { value: '1080p', label: '16:9 · 1080p' },
            ]}
            onChange={(v) => onChange({ renderSize: v, format: `16:9_${v}` as MsSettings['format'], finalRenderSize: v })}
          />
          <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[200px_1fr] sm:items-center" data-testid="ms-setting-media">
            <p className="text-sm font-medium">{MS_LABELS.media}</p>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              {MS_LABELS.mediaValueV1}
            </p>
          </div>
          <div>
            <Segmented
              testId="ms-setting-web-research"
              label={MS_LABELS.webResearch}
              value={s.webResearch ? 'on' : 'off'}
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
              onChange={(v) => onChange({ webResearch: v === 'on' })}
            />
            {s.webResearch ? (
              <p className="-mt-2 pb-4 text-xs text-muted-foreground sm:pl-[208px]" data-testid="ms-web-research-note">
                Uses Google search for current facts. If search fails, writing continues from the model’s knowledge and your uploads.
              </p>
            ) : (
              <p className="-mt-2 pb-4 text-xs text-muted-foreground sm:pl-[208px]">
                The script is written from the model’s knowledge and your uploads.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="Production mode">
        <p className="text-sm font-medium">Review</p>
        <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MS_PRODUCTION_MODES.map((m) => {
            const active = s.productionMode === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`ms-mode-${m.value}`}
                onClick={() => onChange({ productionMode: m.value })}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  active ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:bg-surface-raised',
                )}
              >
                <span className="text-sm font-medium">{m.label}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{m.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      <AllowancePanel allowance={project.allowance} />

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {MS_LABELS.nextPlanHelper}
        </p>
        <Button size="lg" onClick={onPlan} disabled={busy != null} data-testid="ms-next-plan">
          {busy === 'plan' ? 'Creating plan…' : MS_LABELS.nextPlan}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
