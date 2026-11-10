'use client'

import Link from 'next/link'
import { Clapperboard, ImageIcon, Megaphone, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAdStudioClient, AdStudioHttpError, type AdStudioClient, type AdStudioConfig } from '../../lib/ad-studio/client'
import { formatCredits, sanitizeAdStudioMessage, statusLabel } from '../../lib/ad-studio/format'
import type { AdAspect, AdDuration, AdImageVariant, AdMode, AdProductInput, AdStudioRun } from '../../lib/ad-studio/types'
import { DEFAULT_T2V_VOICE } from '../../lib/t2v/voice-defaults'
import { cn } from '../../lib/utils'

type Screen = 'home' | 'brief' | 'run' | 'history'
type SelectableMode = Exclude<AdMode, 'image_ad_to_commercial'>
type UiError = { code: string; message: string }

type Props = {
  client?: AdStudioClient
  sleep?: (ms: number) => Promise<void>
  pollMs?: number
}

const FALLBACK_CONFIG: AdStudioConfig = {
  version: 1,
  aspects: ['9:16', '16:9', '1:1'],
  durationsSec: [15, 30],
  modes: ['storyline', 'image_to_ad', 'image_ad_to_commercial'],
  costs: {},
}

const DEFAULT_INPUT: AdProductInput = {
  name: '',
  sellingPoints: [''],
  aspect: '9:16',
  durationSec: 15,
  imageAssetIds: [],
  voiceId: DEFAULT_T2V_VOICE.voiceId,
  voiceoverEnabled: true,
}

const ACTIVE_STATUSES = new Set(['planning', 'confirming', 'generating', 'stitching'])

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `ad-ui-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function errorOf(err: unknown): UiError {
  if (err instanceof AdStudioHttpError) {
    return { code: err.code, message: sanitizeAdStudioMessage(err.message) }
  }
  if (err instanceof Error) {
    return { code: 'REQUEST_FAILED', message: sanitizeAdStudioMessage(err.message) || 'Ad Studio request failed.' }
  }
  return { code: 'REQUEST_FAILED', message: 'Ad Studio request failed.' }
}

export function AdStudioPage({ client, sleep, pollMs = 2000 }: Props) {
  const liveClient = useMemo(() => client ?? createAdStudioClient(), [client])
  const sleepFn = useMemo(() => sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))), [sleep])
  const [screen, setScreen] = useState<Screen>('home')
  const [mode, setMode] = useState<SelectableMode>('storyline')
  const [input, setInput] = useState<AdProductInput>(DEFAULT_INPUT)
  const [productImage, setProductImage] = useState<File | null>(null)
  const [logoImage, setLogoImage] = useState<File | null>(null)
  const [config, setConfig] = useState<AdStudioConfig>(FALLBACK_CONFIG)
  const [run, setRun] = useState<AdStudioRun | null>(null)
  const [history, setHistory] = useState<AdStudioRun[]>([])
  const [error, setError] = useState<UiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [createKey, setCreateKey] = useState(newIdempotencyKey)
  const [confirmKey, setConfirmKey] = useState(newIdempotencyKey)

  const showError = useCallback((err: unknown) => {
    const safe = errorOf(err)
    console.log('[ad-studio:ui] error', { code: safe.code, message: safe.message })
    setError(safe)
  }, [])

  const refreshHistory = useCallback(async () => {
    console.log('[ad-studio:ui] load', { step: 'history_begin' })
    const result = await liveClient.listRuns({ limit: 20 })
    setHistory(result.runs)
    console.log('[ad-studio:ui] load', { step: 'history_complete', count: result.runs.length, hasNext: Boolean(result.nextCursor) })
  }, [liveClient])

  useEffect(() => {
    let cancelled = false
    console.log('[ad-studio:ui] load', { step: 'begin' })
    void (async () => {
      try {
        const [nextConfig, listed] = await Promise.all([liveClient.getConfig(), liveClient.listRuns({ limit: 20 })])
        if (cancelled) return
        setConfig(nextConfig)
        setHistory(listed.runs)
        console.log('[ad-studio:ui] load', {
          step: 'complete',
          modes: nextConfig.modes.length,
          history: listed.runs.length,
          hasNext: Boolean(listed.nextCursor),
        })
      } catch (err) {
        if (!cancelled) showError(err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [liveClient, showError])

  useEffect(() => {
    if (!run || !ACTIVE_STATUSES.has(run.status)) return
    let cancelled = false
    void (async () => {
      await sleepFn(pollMs)
      if (cancelled) return
      try {
        const next = await liveClient.getRun(run.id)
        console.log('[ad-studio:ui] poll', {
          runId: next.id,
          status: next.status,
          imageAds: next.imageAds?.length ?? 0,
        })
        if (cancelled) return
        setRun(next)
        if (next.status === 'done' || next.status === 'failed' || next.status === 'cancelled') {
          void refreshHistory().catch(showError)
        }
      } catch (err) {
        if (!cancelled) showError(err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [liveClient, pollMs, refreshHistory, run, showError, sleepFn])

  function openMode(next: SelectableMode) {
    console.log('[ad-studio:ui] load', { step: 'mode', mode: next })
    setMode(next)
    setInput({ ...DEFAULT_INPUT, imageAssetIds: [] })
    setProductImage(null)
    setLogoImage(null)
    setRun(null)
    setError(null)
    setCreateKey(newIdempotencyKey())
    setConfirmKey(newIdempotencyKey())
    setScreen('brief')
  }

  async function submitBrief() {
    if (busy) return
    const sellingPoints = input.sellingPoints.map((point) => point.trim()).filter(Boolean)
    if (mode === 'storyline' && sellingPoints.length === 0) {
      showError(new AdStudioHttpError(400, 'INVALID_PARAMS', 'Add at least one selling point for a storyline ad.'))
      return
    }
    if (mode === 'image_to_ad' && !productImage) {
      showError(new AdStudioHttpError(400, 'INVALID_PARAMS', 'Choose a product image before creating an image-to-ad plan.'))
      return
    }

    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] submit', {
      step: 'begin',
      mode,
      hasProductImage: Boolean(productImage),
      hasLogo: Boolean(logoImage),
      voiceoverEnabled: input.voiceoverEnabled !== false,
      voiceIdPresent: Boolean(input.voiceId),
    })
    try {
      const imageAssetIds: string[] = []
      if (productImage) imageAssetIds.push(await liveClient.uploadImage(productImage))
      const logoAssetId = logoImage ? await liveClient.uploadImage(logoImage) : undefined
      console.log('[ad-studio:ui] submit', {
        step: 'assets_complete',
        imageAssets: imageAssetIds.length,
        logoAssetPresent: Boolean(logoAssetId),
      })

      const normalized: AdProductInput = {
        ...input,
        name: input.name.trim(),
        sellingPoints,
        imageAssetIds,
        ...(logoAssetId ? { logoAssetId } : {}),
        ...(input.url?.trim() ? { url: input.url.trim() } : { url: undefined }),
        ...(input.audience?.trim() ? { audience: input.audience.trim() } : { audience: undefined }),
        ...(input.brandNotes?.trim() ? { brandNotes: input.brandNotes.trim() } : { brandNotes: undefined }),
      }
      const created = await liveClient.createRun({ mode, input: normalized, idempotencyKey: createKey })
      console.log('[ad-studio:ui] submit', {
        step: 'complete',
        runId: created.id,
        status: created.status,
        imageAds: created.imageAds?.length ?? 0,
      })
      setInput(created.input)
      setRun(created)
      setScreen('run')
      void refreshHistory().catch(showError)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function confirmPlan() {
    if (!run || run.status !== 'plan_ready' || busy) return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] confirm', { step: 'begin', runId: run.id })
    try {
      const next = await liveClient.confirm(run.id, confirmKey)
      console.log('[ad-studio:ui] confirm', {
        step: 'complete',
        runId: next.id,
        status: next.status,
        imageAds: next.imageAds?.length ?? 0,
      })
      setRun(next)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function replan() {
    if (!run || busy || (run.status !== 'plan_ready' && run.status !== 'draft')) return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] replan', { step: 'begin', runId: run.id })
    try {
      const next = await liveClient.replan(run.id, {
        name: input.name,
        url: input.url,
        sellingPoints: input.sellingPoints,
        audience: input.audience,
        brandNotes: input.brandNotes,
        aspect: input.aspect,
        durationSec: input.durationSec,
        voiceId: input.voiceId,
        voiceoverEnabled: input.voiceoverEnabled,
      })
      console.log('[ad-studio:ui] replan', { step: 'complete', runId: next.id, status: next.status })
      setConfirmKey(newIdempotencyKey())
      setRun(next)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function cancelRun() {
    if (!run || busy) return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] cancel', { step: 'begin', runId: run.id })
    try {
      const next = await liveClient.cancel(run.id)
      console.log('[ad-studio:ui] cancel', { step: 'complete', runId: next.id, status: next.status })
      setRun(next)
      void refreshHistory().catch(showError)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function continueRun() {
    if (!run || busy) return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] continue', { step: 'begin', runId: run.id })
    try {
      const next = await liveClient.continueRun(run.id)
      console.log('[ad-studio:ui] continue', { step: 'complete', runId: next.id, status: next.status })
      setRun(next)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function makeCommercial(variant: AdImageVariant) {
    if (!run || variant.status !== 'ready' || busy) return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] commercial', {
      step: 'begin',
      runId: run.id,
      variantId: variant.id,
      voiceoverEnabled: run.input.voiceoverEnabled !== false,
      voiceIdPresent: Boolean(run.input.voiceId),
    })
    try {
      const result = await liveClient.createCommercial(run.id, {
        variantId: variant.id,
        idempotencyKey: newIdempotencyKey(),
        voiceId: run.input.voiceId,
        voiceoverEnabled: run.input.voiceoverEnabled,
      })
      console.log('[ad-studio:ui] commercial', {
        step: 'complete',
        runId: result.run.id,
        status: result.run.status,
        created: result.created,
      })
      setRun(result.run)
      setInput(result.run.input)
      setConfirmKey(newIdempotencyKey())
      setScreen('run')
      void refreshHistory().catch(showError)
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function openHistoryRun(id: string) {
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] load', { step: 'history_run_begin', runId: id })
    try {
      const next = await liveClient.getRun(id)
      console.log('[ad-studio:ui] load', { step: 'history_run_complete', runId: next.id, status: next.status })
      setRun(next)
      setInput(next.input)
      setScreen('run')
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[32rem] flex-col bg-background" data-testid="ad-studio-shell">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Ad Studio"
          className="flex w-full shrink-0 flex-col gap-3 border-b border-border bg-card/60 px-3 py-4 md:w-56 md:border-r md:border-b-0"
        >
          <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Ad Studio</p>
          <NavButton active={screen !== 'history' && mode === 'storyline'} onClick={() => openMode('storyline')} icon={Sparkles} label="Storyline" testId="ad-studio-nav-storyline" />
          <NavButton active={screen !== 'history' && mode === 'image_to_ad'} onClick={() => openMode('image_to_ad')} icon={ImageIcon} label="Image to ad" testId="ad-studio-nav-image-to-ad" />
          <NavButton active={screen === 'history'} onClick={() => { setScreen('history'); void refreshHistory().catch(showError) }} icon={Clapperboard} label="History" testId="ad-studio-nav-history" />
        </nav>

        <main className="min-w-0 flex-1 overflow-auto p-5" data-testid="ad-studio-main">
          {error ? (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert" data-testid="ad-studio-error">
              <span className="font-medium">{error.code}</span>: {error.message}
            </p>
          ) : null}

          {screen === 'home' ? <ModeHome onSelect={openMode} /> : null}
          {screen === 'brief' ? (
            <BriefForm
              mode={mode}
              input={input}
              config={config}
              productImage={productImage}
              busy={busy}
              onChange={setInput}
              onProductImage={setProductImage}
              onLogoImage={setLogoImage}
              onSubmit={() => void submitBrief()}
            />
          ) : null}
          {screen === 'run' && run ? (
            <RunPanel
              run={run}
              busy={busy}
              onConfirm={() => void confirmPlan()}
              onReplan={() => void replan()}
              onCancel={() => void cancelRun()}
              onContinue={() => void continueRun()}
              onCommercial={(variant) => void makeCommercial(variant)}
            />
          ) : null}
          {screen === 'history' ? <HistoryPanel runs={history} busy={busy} onOpen={(id) => void openHistoryRun(id)} /> : null}
        </main>
      </div>
    </div>
  )
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  label,
  testId,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Sparkles
  label: string
  testId: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  )
}

function ModeHome({ onSelect }: { onSelect: (mode: SelectableMode) => void }) {
  return (
    <div data-testid="ad-studio-mode-home" className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-foreground">Ad Studio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Build a short product ad. Agents choose the models; you review the plan before generation starts.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button type="button" data-testid="ad-studio-mode-storyline" className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40" onClick={() => onSelect('storyline')}>
          <Sparkles className="mb-3 size-5" aria-hidden />
          <p className="text-sm font-medium">Storyline</p>
          <p className="mt-1 text-xs text-muted-foreground">Hook, problem, solution, and CTA with stock plus generated shots.</p>
        </button>
        <button type="button" data-testid="ad-studio-mode-image-to-ad" className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40" onClick={() => onSelect('image_to_ad')}>
          <ImageIcon className="mb-3 size-5" aria-hidden />
          <p className="text-sm font-medium">Image to ad</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload a real product image and turn it into a 15 or 30 second ad.</p>
        </button>
      </div>
    </div>
  )
}

function BriefForm({
  mode,
  input,
  config,
  productImage,
  busy,
  onChange,
  onProductImage,
  onLogoImage,
  onSubmit,
}: {
  mode: SelectableMode
  input: AdProductInput
  config: AdStudioConfig
  productImage: File | null
  busy: boolean
  onChange: (next: AdProductInput) => void
  onProductImage: (file: File | null) => void
  onLogoImage: (file: File | null) => void
  onSubmit: () => void
}) {
  const sellingPointReady = input.sellingPoints.some((point) => point.trim().length > 0)
  const canSubmit = input.name.trim().length > 0
    && (mode !== 'storyline' || sellingPointReady)
    && (mode !== 'image_to_ad' || Boolean(productImage))
    && !busy

  return (
    <form
      data-testid="ad-studio-brief"
      className="mx-auto flex max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit()
      }}
    >
      <h1 className="text-xl font-semibold">{mode === 'storyline' ? 'Storyline brief' : 'Image-to-ad brief'}</h1>

      <label className="text-sm font-medium">
        Product name
        <input data-testid="ad-studio-product-name" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.name} onChange={(e) => onChange({ ...input, name: e.target.value })} required />
      </label>

      <label className="text-sm font-medium">
        Selling points
        <textarea
          data-testid="ad-studio-selling-points"
          className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={input.sellingPoints.join('\n')}
          onChange={(e) => onChange({ ...input, sellingPoints: e.target.value.split('\n') })}
          placeholder="One selling point per line"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Product URL <span className="font-normal text-muted-foreground">(optional)</span>
          <input data-testid="ad-studio-url" type="url" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.url ?? ''} onChange={(e) => onChange({ ...input, url: e.target.value })} />
        </label>
        <label className="text-sm font-medium">
          Audience <span className="font-normal text-muted-foreground">(optional)</span>
          <input data-testid="ad-studio-audience" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.audience ?? ''} onChange={(e) => onChange({ ...input, audience: e.target.value })} />
        </label>
      </div>

      <label className="text-sm font-medium">
        Brand notes <span className="font-normal text-muted-foreground">(optional)</span>
        <textarea data-testid="ad-studio-brand-notes" className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.brandNotes ?? ''} onChange={(e) => onChange({ ...input, brandNotes: e.target.value })} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Length
          <select data-testid="ad-studio-duration" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.durationSec} onChange={(e) => onChange({ ...input, durationSec: Number(e.target.value) as AdDuration })}>
            {config.durationsSec.map((duration) => <option key={duration} value={duration}>{duration}s</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Aspect
          <select data-testid="ad-studio-aspect" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.aspect} onChange={(e) => onChange({ ...input, aspect: e.target.value as AdAspect })}>
            {config.aspects.map((aspect) => <option key={aspect} value={aspect}>{aspect}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Product image {mode === 'image_to_ad' ? <span className="text-destructive">(required)</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
          <input data-testid="ad-studio-product-image" type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => onProductImage(e.target.files?.[0] ?? null)} />
        </label>
        <label className="text-sm font-medium">
          Logo <span className="font-normal text-muted-foreground">(optional)</span>
          <input data-testid="ad-studio-logo-image" type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => onLogoImage(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            data-testid="ad-studio-voiceover-enabled"
            type="checkbox"
            checked={input.voiceoverEnabled !== false}
            onChange={(e) => onChange({ ...input, voiceoverEnabled: e.target.checked })}
          />
          Voiceover
        </label>
        <label className="mt-3 block text-sm font-medium">
          Voice
          <input data-testid="ad-studio-voice-id" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.voiceId ?? DEFAULT_T2V_VOICE.voiceId} onChange={(e) => onChange({ ...input, voiceId: e.target.value })} />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Default: {DEFAULT_T2V_VOICE.voiceName}</span>
        </label>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="ad-studio-credit-estimate">Credits are shown on the generated plan.</p>
      <button type="submit" data-testid="ad-studio-plan-cta" disabled={!canSubmit} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {busy ? 'Planning…' : 'Get plan'}
      </button>
    </form>
  )
}

function RunPanel({
  run,
  busy,
  onConfirm,
  onReplan,
  onCancel,
  onContinue,
  onCommercial,
}: {
  run: AdStudioRun
  busy: boolean
  onConfirm: () => void
  onReplan: () => void
  onCancel: () => void
  onContinue: () => void
  onCommercial: (variant: AdImageVariant) => void
}) {
  const plan = run.plan
  const credits = formatCredits(run.creditEstimate ?? plan?.creditEstimate)
  const imageAds = (run.imageAds ?? []).slice(0, 3)
  const canContinue = run.status === 'failed'
    && run.error?.code === 'KIE_ERROR'
    && !imageAds.some((variant) => variant.status === 'failed')

  if (run.status === 'failed') {
    return (
      <div data-testid="ad-studio-failed" className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">Generation failed</h1>
        <p className="mt-2 text-sm text-destructive">{run.error?.code ?? 'FAILED'}: {sanitizeAdStudioMessage(run.error?.message ?? 'Ad Studio could not complete this run.')}</p>
        <ImageAdVariants variants={imageAds} busy={busy} onCommercial={onCommercial} />
        {canContinue ? (
          <button type="button" data-testid="ad-studio-continue" className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" disabled={busy} onClick={onContinue}>
            Continue without failed video scene
          </button>
        ) : null}
      </div>
    )
  }

  if (run.status === 'cancelled') {
    return (
      <div data-testid="ad-studio-cancelled" className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold">Run cancelled</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start a new Storyline or Image to ad run from the left.</p>
      </div>
    )
  }

  if (run.status === 'done') {
    return (
      <div data-testid="ad-studio-done" className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">Ad ready</h1>
        <p className="mt-1 text-sm text-muted-foreground">{run.input.name} · {credits}</p>
        <div className="mt-4 rounded-xl border border-border bg-card p-4" data-testid="ad-studio-video-result">
          <Megaphone className="mb-2 size-5" aria-hidden />
          <p className="text-sm font-medium">Video result is ready in your project.</p>
          <p className="mt-1 text-xs text-muted-foreground">Use the compact editor for a quick pass or open the full editor for the complete timeline.</p>
        </div>
        <ImageAdVariants variants={imageAds} busy={busy} onCommercial={onCommercial} />
        <div className="mt-5 flex flex-wrap gap-3">
          {run.compactEditorUrl ? (
            <Link href={run.compactEditorUrl} data-testid="ad-studio-open-compact-editor" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Open compact editor
            </Link>
          ) : null}
          {run.fullEditorUrl ? (
            <Link href={run.fullEditorUrl} data-testid="ad-studio-open-full-editor" className="rounded-md border border-border px-4 py-2 text-sm font-medium">
              Open full editor
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  if (run.status === 'confirming' || run.status === 'generating' || run.status === 'stitching') {
    return (
      <div data-testid="ad-studio-progress" className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">{statusLabel(run.status)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{credits}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {run.status === 'stitching'
            ? 'Image ads are ready. Voiceover and final stitching are finishing now.'
            : 'Generating image-ad variants and video scenes from the approved plan.'}
        </p>
        <ImageAdVariants variants={imageAds} busy={busy} onCommercial={onCommercial} />
        <button type="button" data-testid="ad-studio-cancel" className="mt-4 rounded-md border border-border px-3 py-2 text-sm" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    )
  }

  return (
    <div data-testid="ad-studio-plan" className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">{run.status === 'planning' ? 'Planning…' : run.mode === 'image_ad_to_commercial' ? 'Commercial plan' : 'Plan'}</h1>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="ad-studio-plan-credits">{credits}</p>
      {plan ? (
        <>
          <dl className="mt-4 grid gap-2 text-sm" data-testid="ad-studio-script">
            <div><dt className="text-muted-foreground">Hook</dt><dd>{plan.script.hook}</dd></div>
            <div><dt className="text-muted-foreground">Problem</dt><dd>{plan.script.problem}</dd></div>
            <div><dt className="text-muted-foreground">Solution</dt><dd>{plan.script.solution}</dd></div>
            <div><dt className="text-muted-foreground">CTA</dt><dd>{plan.script.cta}</dd></div>
          </dl>
          <ul className="mt-4 space-y-2" data-testid="ad-studio-scenes">
            {plan.scenes.map((scene) => (
              <li key={scene.index} data-testid={`ad-studio-scene-${scene.index}`} data-source={scene.source} className="rounded-md border border-border px-3 py-2 text-sm">
                <p className="font-medium capitalize">{scene.role} · {scene.source} · {scene.durationSec}s</p>
                <p className="text-muted-foreground">{scene.reason}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Building a plan. Confirm stays disabled until planning is complete.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" data-testid="ad-studio-confirm" disabled={run.status !== 'plan_ready' || busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" data-testid="ad-studio-replan" disabled={busy || (run.status !== 'plan_ready' && run.status !== 'draft')} className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50" onClick={onReplan}>
          Re-plan
        </button>
      </div>
    </div>
  )
}

function ImageAdVariants({
  variants,
  busy,
  onCommercial,
}: {
  variants: AdImageVariant[]
  busy: boolean
  onCommercial: (variant: AdImageVariant) => void
}) {
  if (!variants.length) return null
  return (
    <section className="mt-6" aria-labelledby="ad-image-variants-heading">
      <h2 id="ad-image-variants-heading" className="text-sm font-semibold">Image ad variants</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {variants.map((variant) => (
          <article key={variant.id} className="overflow-hidden rounded-xl border border-border bg-card" data-testid="ad-studio-image-variant">
            {variant.downloadUrl ? (
              <img src={variant.downloadUrl} alt={`Generated image ad ${variant.index + 1}`} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center bg-muted text-xs text-muted-foreground">
                {variant.status === 'ready' ? 'Image ready' : statusLabel(variant.status)}
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-medium">{variant.headline}</p>
              <p className="mt-1 text-xs text-muted-foreground">{variant.cta}</p>
              {variant.status === 'ready' ? (
                <button type="button" data-testid="ad-studio-make-commercial" disabled={busy} className="mt-3 w-full rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-50" onClick={() => onCommercial(variant)}>
                  Make commercial from image ad
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function HistoryPanel({ runs, busy, onOpen }: { runs: AdStudioRun[]; busy: boolean; onOpen: (id: string) => void }) {
  return (
    <div data-testid="ad-studio-history" className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Recent Ad Studio runs from the live backend.</p>
      {runs.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No Ad Studio runs yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {runs.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.input.name}</span>
                <span className="text-xs text-muted-foreground">{statusLabel(item.status)}</span>
              </span>
              <button type="button" disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50" onClick={() => onOpen(item.id)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
