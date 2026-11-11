'use client'

import Link from 'next/link'
import { ArrowRight, Clapperboard, ImageIcon, Megaphone, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAdStudioClient, AdStudioHttpError, type AdStudioClient, type AdStudioConfig, type AdStudioFinalRender } from '../../lib/ad-studio/client'
import { formatCredits, sanitizeAdStudioMessage, statusLabel } from '../../lib/ad-studio/format'
import type { AdAspect, AdDuration, AdImageVariant, AdMode, AdProductInput, AdStudioRun } from '../../lib/ad-studio/types'
import { DEFAULT_T2V_VOICE } from '../../lib/t2v/voice-defaults'
import { cn } from '../../lib/utils'
import { Page, PageHeader } from '../app/page-primitives'

type Screen = 'home' | 'brief' | 'run' | 'history'
type SelectableMode = AdMode
type UiError = { code: string; message: string }

type Props = {
  client?: AdStudioClient
  sleep?: (ms: number) => Promise<void>
  pollMs?: number
}

const FALLBACK_CONFIG: AdStudioConfig = {
  version: 1,
  aspects: ['9:16', '16:9', '1:1', '3:4'],
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
  headline: '',
  subHeadline: '',
  cta: '',
  brandColors: { primary: '#111111', secondary: '#FFFFFF' },
  commercialModelId: 'wan-3.0',
}

const ACTIVE_STATUSES = new Set(['planning', 'confirming', 'generating', 'stitching'])
const POLL_READ_RETRY_LIMIT = 4

function pollDelayMs(baseMs: number, failureCount: number) {
  if (failureCount === 0) return baseMs
  return Math.min(Math.max(baseMs, 250) * (2 ** (failureCount - 1)), 15_000)
}

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
  const [configError, setConfigError] = useState<UiError | null>(null)
  const [historyError, setHistoryError] = useState<UiError | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [pollRecovery, setPollRecovery] = useState<{ attempt: number; paused: boolean; error: UiError } | null>(null)
  const [pollRetryToken, setPollRetryToken] = useState(0)
  const [busy, setBusy] = useState(false)
  const [createKey, setCreateKey] = useState(newIdempotencyKey)
  const [confirmKey, setConfirmKey] = useState(newIdempotencyKey)
  const [retryRenderKey, setRetryRenderKey] = useState(newIdempotencyKey)
  const [retryVoiceoverKey, setRetryVoiceoverKey] = useState(newIdempotencyKey)
  const [finalMedia, setFinalMedia] = useState<AdStudioFinalRender | null>(null)
  const [finalMediaLoading, setFinalMediaLoading] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)

  const showError = useCallback((err: unknown) => {
    const safe = errorOf(err)
    console.log('[ad-studio:ui] error', { code: safe.code, message: safe.message })
    setError(safe)
  }, [])

  const refreshHistory = useCallback(async () => {
    console.log('[ad-studio:ui] load', { step: 'history_begin' })
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const result = await liveClient.listRuns({ limit: 20 })
      setHistory(result.runs)
      console.log('[ad-studio:ui] load', { step: 'history_complete', count: result.runs.length, hasNext: Boolean(result.nextCursor) })
    } catch (err) {
      const safe = errorOf(err)
      console.log('[ad-studio:ui] load', { step: 'history_error', code: safe.code })
      setHistoryError(safe)
      throw err
    } finally {
      setHistoryLoading(false)
    }
  }, [liveClient])

  const retryConfig = useCallback(async () => {
    console.log('[ad-studio:ui] load', { step: 'config_retry_begin' })
    setConfigLoading(true)
    setConfigError(null)
    try {
      const nextConfig = await liveClient.getConfig()
      setConfig(nextConfig)
      console.log('[ad-studio:ui] load', { step: 'config_retry_complete', modes: nextConfig.modes.length })
    } catch (err) {
      const safe = errorOf(err)
      console.log('[ad-studio:ui] load', { step: 'config_retry_error', code: safe.code })
      setConfigError(safe)
    } finally {
      setConfigLoading(false)
    }
  }, [liveClient])

  useEffect(() => {
    let cancelled = false
    console.log('[ad-studio:ui] load', { step: 'begin' })
    setConfigLoading(true)
    setHistoryLoading(true)
    setConfigError(null)
    setHistoryError(null)

    void liveClient.getConfig()
      .then((nextConfig) => {
        if (cancelled) return
        setConfig(nextConfig)
        console.log('[ad-studio:ui] load', { step: 'config_complete', modes: nextConfig.modes.length })
      })
      .catch((err) => {
        if (cancelled) return
        const safe = errorOf(err)
        console.log('[ad-studio:ui] load', { step: 'config_error', code: safe.code })
        setConfigError(safe)
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false)
      })

    void liveClient.listRuns({ limit: 20 })
      .then((listed) => {
        if (cancelled) return
        setHistory(listed.runs)
        console.log('[ad-studio:ui] load', {
          step: 'history_complete',
          history: listed.runs.length,
          hasNext: Boolean(listed.nextCursor),
        })
      })
      .catch((err) => {
        if (cancelled) return
        const safe = errorOf(err)
        console.log('[ad-studio:ui] load', { step: 'history_error', code: safe.code })
        setHistoryError(safe)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [liveClient])

  useEffect(() => {
    if (!run || !ACTIVE_STATUSES.has(run.status)) {
      setPollRecovery(null)
      return
    }

    const runId = run.id
    let cancelled = false
    let failureCount = 0

    void (async () => {
      while (!cancelled) {
        const delayMs = pollDelayMs(pollMs, failureCount)
        await sleepFn(delayMs)
        if (cancelled) return

        try {
          const next = await liveClient.getRun(runId)
          console.log('[ad-studio:ui] poll', {
            step: 'complete',
            runId: next.id,
            status: next.status,
            imageAds: next.imageAds?.length ?? 0,
          })
          if (cancelled) return
          failureCount = 0
          setPollRecovery(null)
          setRun((current) => current?.id === runId ? next : current)
          if (!ACTIVE_STATUSES.has(next.status)) {
            if (next.status === 'done' || next.status === 'failed' || next.status === 'cancelled') {
              void refreshHistory().catch(showError)
            }
            return
          }
        } catch (err) {
          if (cancelled) return
          failureCount += 1
          const safe = errorOf(err)
          const paused = failureCount >= POLL_READ_RETRY_LIMIT
          console.log('[ad-studio:ui] poll', {
            step: paused ? 'paused' : 'retry',
            runId,
            attempt: failureCount,
            code: safe.code,
            retryInMs: paused ? null : pollDelayMs(pollMs, failureCount),
          })
          setPollRecovery({ attempt: failureCount, paused, error: safe })
          if (paused) return
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [liveClient, pollMs, pollRetryToken, refreshHistory, run?.id, run?.status, showError, sleepFn])

  useEffect(() => {
    let cancelled = false
    if (!run || run.status !== 'done' || run.mode === 'image_to_ad') {
      setFinalMedia(null)
      setFinalMediaLoading(false)
      return () => { cancelled = true }
    }
    const runId = run.id
    setFinalMediaLoading(true)
    console.log('[ad-studio:ui] final_media', { step: 'playback_begin', runId })
    void liveClient.getFinalRender(runId)
      .then((media) => {
        if (cancelled) return
        setFinalMedia(media)
        console.log('[ad-studio:ui] final_media', { step: 'playback_complete', runId, ready: true })
      })
      .catch((err) => {
        if (cancelled) return
        const safe = errorOf(err)
        console.log('[ad-studio:ui] final_media', { step: 'playback_error', runId, code: safe.code })
        setFinalMedia(null)
      })
      .finally(() => {
        if (!cancelled) setFinalMediaLoading(false)
      })
    return () => { cancelled = true }
  }, [liveClient, run?.id, run?.mode, run?.status])

  function openMode(next: SelectableMode) {
    console.log('[ad-studio:ui] load', { step: 'mode', mode: next })
    setMode(next)
    setInput({
      ...DEFAULT_INPUT,
      imageAssetIds: [],
      durationSec: 15,
      voiceoverEnabled: next === 'storyline',
    })
    setProductImage(null)
    setLogoImage(null)
    setRun(null)
    setError(null)
    setCreateKey(newIdempotencyKey())
    setConfirmKey(newIdempotencyKey())
    setRetryRenderKey(newIdempotencyKey())
    setScreen('brief')
  }

  async function submitBrief() {
    if (busy) return
    const sellingPoints = input.sellingPoints.map((point) => point.trim()).filter(Boolean)
    if (mode === 'storyline' && sellingPoints.length === 0) {
      showError(new AdStudioHttpError(400, 'INVALID_PARAMS', 'Add at least one selling point for a storyline ad.'))
      return
    }
    if ((mode === 'image_to_ad' || mode === 'image_ad_to_commercial') && !productImage) {
      showError(new AdStudioHttpError(400, 'INVALID_PARAMS', mode === 'image_to_ad'
        ? 'Choose a product image before creating a photo-ad plan.'
        : 'Choose a finished ad still to animate.'))
      return
    }
    if (mode === 'image_to_ad' && (!input.headline?.trim() || !input.subHeadline?.trim() || !input.cta?.trim())) {
      showError(new AdStudioHttpError(400, 'INVALID_PARAMS', 'Headline, sub-headline, and CTA are required for photo ads.'))
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
      const next = mode === 'image_ad_to_commercial' && created.status === 'plan_ready'
        ? await liveClient.confirm(created.id, confirmKey)
        : created
      console.log('[ad-studio:ui] submit', {
        step: 'complete',
        runId: next.id,
        status: next.status,
        imageAds: next.imageAds?.length ?? 0,
        directCommercial: mode === 'image_ad_to_commercial',
      })
      setInput(next.input)
      setRun(next)
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

  async function retryFinalRender() {
    if (!run || busy || run.status !== 'failed' || run.error?.code !== 'RENDER_ERROR' || run.canRetryRender !== true) return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] retry_render', { step: 'begin', runId: run.id })
    try {
      const next = await liveClient.retryRender(run.id, retryRenderKey)
      console.log('[ad-studio:ui] retry_render', { step: 'complete', runId: next.id, status: next.status })
      setRun(next)
      setRetryRenderKey(newIdempotencyKey())
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function retryVoiceoverAndRender() {
    if (!run || busy || run.status !== 'failed' || run.canRetryVoiceover !== true) return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] retry_voice', { step: 'begin', runId: run.id })
    try {
      const next = await liveClient.retryVoiceover(run.id, retryVoiceoverKey)
      console.log('[ad-studio:ui] retry_voice', { step: 'complete', runId: next.id, status: next.status })
      setRun(next)
      setRetryVoiceoverKey(newIdempotencyKey())
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  async function downloadFinalRender() {
    if (!run || run.status !== 'done' || downloadBusy) return
    setDownloadBusy(true)
    setError(null)
    console.log('[ad-studio:ui] final_media', { step: 'download_begin', runId: run.id })
    try {
      const media = await liveClient.getFinalRender(run.id, true)
      const anchor = document.createElement('a')
      anchor.href = media.url
      anchor.download = media.filename || 'ad-studio.mp4'
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      console.log('[ad-studio:ui] final_media', { step: 'download_complete', runId: run.id, filename: media.filename })
    } catch (err) {
      showError(err)
    } finally {
      setDownloadBusy(false)
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
        voiceoverEnabled: false,
        modelId: run.input.commercialModelId ?? 'wan-3.0',
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

  async function regenerateStill(variant: AdImageVariant) {
    if (!run || busy || run.mode !== 'image_to_ad') return
    setBusy(true)
    setError(null)
    console.log('[ad-studio:ui] still_regenerate', { step: 'begin', runId: run.id, variantId: variant.id })
    try {
      const next = await liveClient.regenerateStill(run.id, variant.id, newIdempotencyKey())
      console.log('[ad-studio:ui] still_regenerate', { step: 'complete', runId: next.id, status: next.status, variantId: variant.id })
      setRun(next)
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
    <Page>
      <div className="flex min-w-0 flex-col gap-6" data-testid="ad-studio-shell">
        <PageHeader
          icon={Megaphone}
          iconTone="brand"
          title="Ad Studio"
          description="Create five finished photo ads from a real product image, then animate the strongest creative into a native-audio 15s commercial. Storyline remains available for stitched multi-scene ads."
        />

        <div className="grid min-w-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav
            aria-label="Ad Studio"
            className="flex min-w-0 flex-wrap gap-2 rounded-xl border border-border bg-card p-3 shadow-sm lg:sticky lg:top-6 lg:self-start lg:flex-col"
          >
            <p className="w-full px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Create</p>
            <NavButton active={screen !== 'history' && mode === 'storyline'} onClick={() => openMode('storyline')} icon={Sparkles} label="Storyline" testId="ad-studio-nav-storyline" />
            <NavButton active={screen !== 'history' && mode === 'image_to_ad'} onClick={() => openMode('image_to_ad')} icon={ImageIcon} label="Photo ads → video" testId="ad-studio-nav-image-to-ad" />
            <NavButton active={screen !== 'history' && mode === 'image_ad_to_commercial'} onClick={() => openMode('image_ad_to_commercial')} icon={Clapperboard} label="Animate ad still" testId="ad-studio-nav-animate-still" />
            <NavButton active={screen === 'history'} onClick={() => { setScreen('history'); void refreshHistory().catch(showError) }} icon={Clapperboard} label="History" testId="ad-studio-nav-history" />
          </nav>

          <main className="min-w-0" data-testid="ad-studio-main">
            {error ? (
              <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert" data-testid="ad-studio-error">
                <span className="font-medium">{error.code}</span>: {error.message}
              </p>
            ) : null}

            {configError || historyError ? (
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="ad-studio-read-recovery">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Some Ad Studio data could not refresh.</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {configError ? 'Using safe creation defaults until configuration reconnects. ' : ''}
                    {historyError ? 'Keeping any previously loaded recent work while history reconnects.' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {configError ? (
                    <button type="button" data-testid="ad-studio-retry-config" disabled={configLoading} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50" onClick={() => void retryConfig()}>
                      {configLoading ? 'Retrying…' : 'Retry config'}
                    </button>
                  ) : null}
                  {historyError ? (
                    <button type="button" data-testid="ad-studio-retry-history" disabled={historyLoading} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50" onClick={() => void refreshHistory().catch(() => undefined)}>
                      {historyLoading ? 'Retrying…' : 'Retry history'}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {pollRecovery ? (
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="ad-studio-poll-recovery">
                <div>
                  <p className="text-sm font-medium">{pollRecovery.paused ? 'Live status updates are paused.' : 'Connection interrupted. Reconnecting…'}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pollRecovery.paused
                      ? 'The latest run state is preserved. Retry only checks status; it does not restart or confirm generation.'
                      : `Read retry ${pollRecovery.attempt} of ${POLL_READ_RETRY_LIMIT} · ${pollRecovery.error.code}`}
                  </p>
                </div>
                {pollRecovery.paused ? (
                  <button
                    type="button"
                    data-testid="ad-studio-retry-poll"
                    className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    onClick={() => {
                      setPollRecovery(null)
                      setPollRetryToken((value) => value + 1)
                    }}
                  >
                    Retry status
                  </button>
                ) : null}
              </div>
            ) : null}

            {screen === 'home' ? (
              <ModeHome
                onSelect={openMode}
                runs={history}
                busy={busy}
                historyLoading={historyLoading}
                historyUnavailable={Boolean(historyError)}
                onOpen={(id) => void openHistoryRun(id)}
                onViewHistory={() => { setScreen('history'); void refreshHistory().catch(showError) }}
              />
            ) : null}
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
                onRetryRender={() => void retryFinalRender()}
                onRetryVoiceover={() => void retryVoiceoverAndRender()}
                finalMedia={finalMedia}
                finalMediaLoading={finalMediaLoading}
                downloadBusy={downloadBusy}
                onDownload={() => void downloadFinalRender()}
                onCommercial={(variant) => void makeCommercial(variant)}
                onRegenerateStill={(variant) => void regenerateStill(variant)}
              />
            ) : null}
            {screen === 'history' ? <HistoryPanel runs={history} busy={busy} loading={historyLoading} unavailable={Boolean(historyError)} onOpen={(id) => void openHistoryRun(id)} /> : null}
          </main>
        </div>
      </div>
    </Page>
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
        'flex min-w-[9rem] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors lg:min-w-0 lg:flex-none lg:justify-start',
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

function ModeHome({
  onSelect,
  runs,
  busy,
  historyLoading,
  historyUnavailable,
  onOpen,
  onViewHistory,
}: {
  onSelect: (mode: SelectableMode) => void
  runs: AdStudioRun[]
  busy: boolean
  historyLoading: boolean
  historyUnavailable: boolean
  onOpen: (id: string) => void
  onViewHistory: () => void
}) {
  const recent = runs.slice(0, 4)

  return (
    <div data-testid="ad-studio-mode-home" className="flex min-w-0 flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Product creative, end to end</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">From source material to an editable ad</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Start with a product brief or a real product image. Ad Studio builds the plan first, keeps generation behind explicit confirmation, and hands the finished result to the editors you already use.
          </p>
        </div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ad Studio workflow">
          {['Brief', 'Review plan', 'Generate', 'Edit or export'].map((step, index) => (
            <li key={step} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
              <span className="text-sm font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          data-testid="ad-studio-mode-storyline"
          className="group flex min-h-44 flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-foreground/20 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => onSelect('storyline')}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <p className="mt-5 text-base font-semibold">Storyline</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Build a hook, problem, solution, and CTA from your brief, with stock and generated shots selected for the plan.</p>
          <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-medium text-primary">Start with a brief <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
        </button>
        <button
          type="button"
          data-testid="ad-studio-mode-image-to-ad"
          className="group flex min-h-44 flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-foreground/20 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => onSelect('image_to_ad')}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <ImageIcon className="size-5" aria-hidden />
          </span>
          <p className="mt-5 text-base font-semibold">Photo ads → 15s video</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Generate five 2K finished ad stills from your real product photo, pick a winner, then animate it as one native-audio 15s commercial.</p>
          <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-medium text-primary">Create five ads <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
        </button>
        <button
          type="button"
          data-testid="ad-studio-mode-animate-still"
          className="group flex min-h-44 flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-foreground/20 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => onSelect('image_ad_to_commercial')}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Clapperboard className="size-5" aria-hidden /></span>
          <p className="mt-5 text-base font-semibold">Animate finished ad</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Already have a finished ad still? Upload it and go straight to a single 15s Wan 3.0 or Seedance 2.5 native-audio video.</p>
          <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-medium text-primary">Animate still <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
        </button>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="ad-studio-recent-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="ad-studio-recent-heading" className="text-sm font-semibold">Recent work</h2>
            <p className="mt-1 text-xs text-muted-foreground">Real Ad Studio runs from this workspace.</p>
          </div>
          <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onViewHistory}>
            View history
          </button>
        </div>
        {historyLoading && recent.length === 0 ? (
          <div className="mt-4 rounded-lg border border-border bg-background/50 px-4 py-8 text-center" data-testid="ad-studio-recent-loading">
            <p className="text-sm font-medium">Loading recent work…</p>
            <p className="mt-1 text-xs text-muted-foreground">Checking your latest Ad Studio runs.</p>
          </div>
        ) : historyUnavailable && recent.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Clapperboard className="mx-auto size-5 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-medium">Recent work is temporarily unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">Retry history above. Creation remains available with the data already loaded.</p>
          </div>
        ) : recent.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Clapperboard className="mx-auto size-5 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-medium">No recent runs yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Your first planned or generated ad will appear here.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {recent.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid="ad-studio-recent-run"
                disabled={busy}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                onClick={() => onOpen(item.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.input.name || 'Untitled ad'}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.mode === 'image_to_ad' ? 'Image to ad' : item.mode === 'image_ad_to_commercial' ? 'Image commercial' : 'Storyline'} · {statusLabel(item.status)}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </section>
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
  const photoCopyReady = Boolean(input.headline?.trim() && input.subHeadline?.trim() && input.cta?.trim() && input.brandColors?.primary)
  const needsImage = mode === 'image_to_ad' || mode === 'image_ad_to_commercial'
  const canSubmit = input.name.trim().length > 0
    && (mode !== 'storyline' || sellingPointReady)
    && (mode !== 'image_to_ad' || (sellingPointReady && photoCopyReady))
    && (!needsImage || Boolean(productImage))
    && !busy
  const aspects = mode === 'storyline' ? config.aspects.filter((aspect) => aspect !== '3:4') : config.aspects

  return (
    <form
      data-testid="ad-studio-brief"
      className="mx-auto flex w-full max-w-3xl flex-col gap-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit()
      }}
    >
      <div>
        <h1 className="text-xl font-semibold">
          {mode === 'storyline' ? 'Storyline brief' : mode === 'image_to_ad' ? 'Create 5 photo ads' : 'Animate a finished ad still'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'storyline'
            ? 'Build the existing stitched multi-scene commercial from a product brief.'
            : mode === 'image_to_ad'
              ? 'Your product photo is the source of truth. Review the five concepts before any paid still generation starts.'
              : 'One uploaded finished still becomes one native-audio 15s commercial. No TTS or stitched-scene pass is used.'}
        </p>
      </div>

      <label className="text-sm font-medium">
        {mode === 'image_ad_to_commercial' ? 'Ad / product name' : 'Product name'}
        <input data-testid="ad-studio-product-name" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.name} onChange={(e) => onChange({ ...input, name: e.target.value })} required />
      </label>

      {mode !== 'image_ad_to_commercial' ? (
        <label className="text-sm font-medium">
          {mode === 'image_to_ad' ? 'Product / offer info' : 'Selling points'}
          <textarea
            data-testid="ad-studio-selling-points"
            className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={input.sellingPoints.join('\n')}
            onChange={(e) => onChange({ ...input, sellingPoints: e.target.value.split('\n') })}
            placeholder={mode === 'image_to_ad' ? 'Product truth and offer details — one point per line' : 'One selling point per line'}
          />
        </label>
      ) : null}

      {mode === 'image_to_ad' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Headline
              <input data-testid="ad-studio-headline" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.headline ?? ''} onChange={(e) => onChange({ ...input, headline: e.target.value })} />
            </label>
            <label className="text-sm font-medium">Sub-headline
              <input data-testid="ad-studio-subheadline" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.subHeadline ?? ''} onChange={(e) => onChange({ ...input, subHeadline: e.target.value })} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">CTA
              <input data-testid="ad-studio-cta" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.cta ?? ''} onChange={(e) => onChange({ ...input, cta: e.target.value })} />
            </label>
            <label className="text-sm font-medium">Primary color
              <input data-testid="ad-studio-primary-color" type="color" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2" value={input.brandColors?.primary ?? '#111111'} onChange={(e) => onChange({ ...input, brandColors: { primary: e.target.value, secondary: input.brandColors?.secondary } })} />
            </label>
            <label className="text-sm font-medium">Secondary color
              <input data-testid="ad-studio-secondary-color" type="color" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2" value={input.brandColors?.secondary ?? '#FFFFFF'} onChange={(e) => onChange({ ...input, brandColors: { primary: input.brandColors?.primary ?? '#111111', secondary: e.target.value } })} />
            </label>
          </div>
        </>
      ) : null}

      {mode === 'storyline' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Product URL <span className="font-normal text-muted-foreground">(optional)</span>
              <input data-testid="ad-studio-url" type="url" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.url ?? ''} onChange={(e) => onChange({ ...input, url: e.target.value })} />
            </label>
            <label className="text-sm font-medium">Audience <span className="font-normal text-muted-foreground">(optional)</span>
              <input data-testid="ad-studio-audience" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.audience ?? ''} onChange={(e) => onChange({ ...input, audience: e.target.value })} />
            </label>
          </div>
          <label className="text-sm font-medium">Brand notes <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea data-testid="ad-studio-brand-notes" className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.brandNotes ?? ''} onChange={(e) => onChange({ ...input, brandNotes: e.target.value })} />
          </label>
        </>
      ) : mode === 'image_to_ad' ? (
        <label className="text-sm font-medium">Brand notes <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea data-testid="ad-studio-brand-notes" className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.brandNotes ?? ''} onChange={(e) => onChange({ ...input, brandNotes: e.target.value })} />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {mode === 'storyline' ? (
          <label className="text-sm font-medium">Length
            <select data-testid="ad-studio-duration" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.durationSec} onChange={(e) => onChange({ ...input, durationSec: Number(e.target.value) as AdDuration })}>
              {config.durationsSec.map((duration) => <option key={duration} value={duration}>{duration}s</option>)}
            </select>
          </label>
        ) : (
          <div className="rounded-md border border-border bg-background px-3 py-2 text-sm"><span className="font-medium">Length</span><span className="ml-2 text-muted-foreground">15s</span></div>
        )}
        <label className="text-sm font-medium">Aspect
          <select
            data-testid="ad-studio-aspect"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={input.aspect}
            onChange={(e) => {
              const aspect = e.target.value as AdAspect
              onChange({
                ...input,
                aspect,
                ...(input.commercialModelId === 'seedance-2.0-mini' && aspect !== '1:1' ? { commercialModelId: 'wan-3.0' } : {}),
              })
            }}
          >
            {aspects.map((aspect) => <option key={aspect} value={aspect}>{aspect}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {mode === 'image_ad_to_commercial' ? 'Finished ad still' : 'Product image'} {needsImage ? <span className="text-destructive">(required)</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
          <input data-testid="ad-studio-product-image" type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => onProductImage(e.target.files?.[0] ?? null)} />
        </label>
        {mode !== 'image_ad_to_commercial' ? (
          <label className="text-sm font-medium">Logo <span className="font-normal text-muted-foreground">(optional)</span>
            <input data-testid="ad-studio-logo-image" type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => onLogoImage(e.target.files?.[0] ?? null)} />
          </label>
        ) : null}
      </div>

      {mode !== 'storyline' ? (
        <label className="text-sm font-medium">15s animation model
          <select
            data-testid="ad-studio-commercial-model"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={input.commercialModelId ?? 'wan-3.0'}
            onChange={(e) => onChange({ ...input, commercialModelId: e.target.value as NonNullable<AdProductInput['commercialModelId']> })}
          >
            <option value="wan-3.0">Wan 3.0 · default · native audio</option>
            <option value="seedance-2.5">Seedance 2.5 · dialogue / lip-sync · native audio</option>
            {input.aspect === '1:1' ? <option value="seedance-2.0-mini">Seedance 2.0 Mini · 480p test · native audio</option> : null}
          </select>
        </label>
      ) : null}

      {mode === 'storyline' ? (
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input data-testid="ad-studio-voiceover-enabled" type="checkbox" checked={input.voiceoverEnabled !== false} onChange={(e) => onChange({ ...input, voiceoverEnabled: e.target.checked })} />
            Voiceover
          </label>
          <label className="mt-3 block text-sm font-medium">Voice
            <input data-testid="ad-studio-voice-id" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={input.voiceId ?? DEFAULT_T2V_VOICE.voiceId} onChange={(e) => onChange({ ...input, voiceId: e.target.value })} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Default: {DEFAULT_T2V_VOICE.voiceName}</span>
          </label>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground" data-testid="ad-studio-credit-estimate">
        {mode === 'storyline' ? 'Credits are shown on the generated plan.' : 'Credits TBD'}
      </p>
      <button type="submit" data-testid="ad-studio-plan-cta" disabled={!canSubmit} className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {busy ? (mode === 'image_ad_to_commercial' ? 'Starting commercial…' : 'Planning…') : mode === 'image_ad_to_commercial' ? 'Animate → 15s commercial' : 'Get plan'}
      </button>
    </form>
  )
}

function formatAdSceneModel(scene: NonNullable<AdStudioRun['plan']>['scenes'][number]): string {
  if (scene.modelId === 'seedance-2.0-mini') return 'Seedance 2.0 Mini · 480p'
  if (scene.modelId === 'veo-3.1-lite') return 'Veo 3.1 Lite · 720p'
  return scene.modelId ?? 'Generated video'
}

function RunPanel({
  run,
  busy,
  onConfirm,
  onReplan,
  onCancel,
  onContinue,
  onRetryRender,
  onRetryVoiceover,
  finalMedia,
  finalMediaLoading,
  downloadBusy,
  onDownload,
  onCommercial,
  onRegenerateStill,
}: {
  run: AdStudioRun
  busy: boolean
  onConfirm: () => void
  onReplan: () => void
  onCancel: () => void
  onContinue: () => void
  onRetryRender: () => void
  onRetryVoiceover: () => void
  finalMedia: AdStudioFinalRender | null
  finalMediaLoading: boolean
  downloadBusy: boolean
  onDownload: () => void
  onCommercial: (variant: AdImageVariant) => void
  onRegenerateStill: (variant: AdImageVariant) => void
}) {
  const plan = run.plan
  const credits = formatCredits(run.creditEstimate ?? plan?.creditEstimate)
  const imageAds = (run.imageAds ?? []).slice(0, 5)
  const canContinue = run.status === 'failed'
    && run.error?.code === 'KIE_ERROR'
    && !imageAds.some((variant) => variant.status === 'failed')
  const canRetryRender = run.status === 'failed'
    && run.error?.code === 'RENDER_ERROR'
    && run.canRetryRender === true
  const canRetryVoiceover = run.status === 'failed'
    && run.canRetryVoiceover === true

  if (run.status === 'failed') {
    return (
      <div data-testid="ad-studio-failed" className="mx-auto w-full max-w-3xl rounded-xl border border-destructive/30 bg-card p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">Generation failed</h1>
        <p className="mt-2 text-sm text-destructive">{run.error?.code ?? 'FAILED'}: {sanitizeAdStudioMessage(run.error?.message ?? 'Ad Studio could not complete this run.')}</p>
        <ImageAdVariants variants={imageAds} busy={busy} aspect={run.input.aspect} mode={run.mode} onCommercial={onCommercial} onRegenerate={onRegenerateStill} />
        {canContinue ? (
          <button type="button" data-testid="ad-studio-continue" className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" disabled={busy} onClick={onContinue}>
            Continue without failed video scene
          </button>
        ) : null}
        {canRetryRender ? (
          <div className="mt-4">
            <button type="button" data-testid="ad-studio-retry-render" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy} onClick={onRetryRender}>
              {busy ? 'Retrying final render…' : 'Retry final render'}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">Uses the existing generated scenes, image ads, and voiceover. No additional credits are charged.</p>
          </div>
        ) : null}
        {canRetryVoiceover ? (
          <div className="mt-4">
            <button type="button" data-testid="ad-studio-retry-voiceover" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy} onClick={onRetryVoiceover}>
              {busy ? 'Retrying voiceover & render…' : 'Retry voiceover & render'}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">Regenerates only the voiceover, then reuses the existing video scenes and image ads for the final render.</p>
          </div>
        ) : null}
      </div>
    )
  }

  if (run.status === 'cancelled') {
    return (
      <div data-testid="ad-studio-cancelled" className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">Run cancelled</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start a new Storyline or Image to ad run from the left.</p>
      </div>
    )
  }

  if (run.status === 'done' && run.mode === 'image_to_ad') {
    return (
      <div data-testid="ad-studio-photo-ads-ready" className="mx-auto w-full max-w-5xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">5 photo ads ready</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick any finished still to download or animate into one native-audio 15s commercial · Credits TBD
        </p>
        {plan?.photoAds ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Art director: {plan.photoAds.conceptModel} · style references loaded: {plan.photoAds.styleReferenceCount}
          </p>
        ) : null}
        <ImageAdVariants
          variants={imageAds}
          busy={busy}
          aspect={run.input.aspect}
          mode={run.mode}
          onCommercial={onCommercial}
          onRegenerate={onRegenerateStill}
        />
      </div>
    )
  }

  if (run.status === 'done') {
    return (
      <div data-testid="ad-studio-done" className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">Ad ready</h1>
        <p className="mt-1 text-sm text-muted-foreground">{run.input.name} · {credits}</p>
        <div className="mt-4 rounded-xl border border-border bg-card p-4" data-testid="ad-studio-video-result">
          <Megaphone className="mb-2 size-5" aria-hidden />
          <p className="text-sm font-medium">Video result is ready in your project.</p>
          {finalMedia?.url ? (
            <video
              src={finalMedia.url}
              controls
              preload="metadata"
              className="mt-3 max-h-[34rem] w-full rounded-lg bg-black object-contain"
              style={{ aspectRatio: run.input.aspect.replace(':', ' / ') }}
              data-testid="ad-studio-final-video"
            />
          ) : (
            <div className="mt-3 flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground" data-testid="ad-studio-final-video-loading">
              {finalMediaLoading ? 'Loading final video…' : 'Final video preview is unavailable. Open the editor to review it.'}
            </div>
          )}
          <button
            type="button"
            data-testid="ad-studio-download-mp4"
            className="mt-3 rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={downloadBusy}
            onClick={onDownload}
          >
            {downloadBusy ? 'Preparing download…' : 'Download MP4'}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">Use the compact editor for a quick pass or open the full editor for the complete timeline.</p>
        </div>
        <ImageAdVariants variants={imageAds} busy={busy} aspect={run.input.aspect} mode={run.mode} onCommercial={onCommercial} onRegenerate={onRegenerateStill} />
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
      <div data-testid="ad-studio-progress" className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">{statusLabel(run.status)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{credits}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {run.mode === 'image_to_ad'
            ? 'Generating five 2K finished stills. QC flags issues but never regenerates automatically.'
            : run.mode === 'image_ad_to_commercial'
              ? 'Animating the selected still as one native-audio 15s commercial.'
              : run.status === 'stitching'
                ? 'Image ads are ready. Voiceover and final stitching are finishing now.'
                : 'Generating image-ad variants and video scenes from the approved plan.'}
        </p>
        <ImageAdVariants variants={imageAds} busy={busy} aspect={run.input.aspect} mode={run.mode} onCommercial={onCommercial} onRegenerate={onRegenerateStill} />
        <button type="button" data-testid="ad-studio-cancel" className="mt-4 rounded-md border border-border px-3 py-2 text-sm" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    )
  }

  return (
    <div data-testid="ad-studio-plan" className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold">{run.status === 'planning' ? 'Planning…' : run.mode === 'image_ad_to_commercial' ? 'Commercial plan' : 'Plan'}</h1>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="ad-studio-plan-credits">{credits}</p>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="ad-studio-final-render-resolution">Final render · 720p</p>
      {plan ? (
        <>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2" data-testid="ad-studio-script">
            <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="text-xs font-medium text-muted-foreground">Hook</dt><dd className="mt-1">{plan.script.hook}</dd></div>
            <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="text-xs font-medium text-muted-foreground">Problem</dt><dd className="mt-1">{plan.script.problem}</dd></div>
            <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="text-xs font-medium text-muted-foreground">Solution</dt><dd className="mt-1">{plan.script.solution}</dd></div>
            <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="text-xs font-medium text-muted-foreground">CTA</dt><dd className="mt-1">{plan.script.cta}</dd></div>
          </dl>
          {plan.photoAds?.concepts?.length ? (
            <div className="mt-5" data-testid="ad-studio-photo-concepts">
              <h2 className="text-sm font-semibold">Five legacy art directions</h2>
              <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                {plan.photoAds.concepts.map((concept, index) => (
                  <li key={index} className="rounded-lg border border-border bg-background/50 p-3 text-sm">
                    <p className="font-medium">{index + 1}. {concept.style}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{concept.layoutNotes}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <ul className="mt-4 space-y-2" data-testid="ad-studio-scenes">
            {plan.scenes.map((scene) => (
              <li key={scene.index} data-testid={`ad-studio-scene-${scene.index}`} data-source={scene.source} className="rounded-lg border border-border bg-background/50 px-3 py-3 text-sm">
                <p className="font-medium capitalize">{scene.role} · {scene.source} · {scene.durationSec}s</p>
                {scene.source === 'generated' ? (
                  <p className="text-muted-foreground" data-testid={`ad-studio-scene-model-${scene.index}`}>
                    {formatAdSceneModel(scene)}
                  </p>
                ) : null}
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
  aspect,
  mode,
  onCommercial,
  onRegenerate,
}: {
  variants: AdImageVariant[]
  busy: boolean
  aspect: AdAspect
  mode: AdMode
  onCommercial: (variant: AdImageVariant) => void
  onRegenerate: (variant: AdImageVariant) => void
}) {
  if (!variants.length) return null
  return (
    <section className="mt-6" aria-labelledby="ad-image-variants-heading">
      <h2 id="ad-image-variants-heading" className="text-sm font-semibold">
        {mode === 'image_to_ad' ? 'Finished photo ads' : 'Image ad variants'}
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {variants.map((variant) => {
          const flagged = variant.qc && variant.qc.decision !== 'pass'
          return (
            <article key={variant.id} className="overflow-hidden rounded-xl border border-border bg-background/50 shadow-sm" data-testid="ad-studio-image-variant">
              {variant.downloadUrl ? (
                <img
                  src={variant.downloadUrl}
                  alt={`Generated image ad ${variant.index + 1}`}
                  className="w-full bg-muted object-contain"
                  style={{ aspectRatio: aspect.replace(':', ' / ') }}
                />
              ) : (
                <div className="flex min-h-48 items-center justify-center bg-muted text-xs text-muted-foreground">
                  {variant.status === 'ready' ? 'Image ready' : statusLabel(variant.status)}
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-medium">{variant.headline}</p>
                <p className="mt-1 text-xs text-muted-foreground">{variant.cta}</p>
                {variant.qc ? (
                  <div className={cn('mt-2 rounded-md border px-2 py-2 text-xs', flagged ? 'border-warning/40 bg-warning/10' : 'border-border bg-muted/30')} data-testid="ad-studio-still-qc">
                    <p className="font-medium">QC {variant.qc.decision} · {variant.qc.weightedScore.toFixed(2)}/10</p>
                    <p className="mt-1 text-muted-foreground">{variant.qc.reason}</p>
                    {variant.qc.issues.length ? <p className="mt-1 text-muted-foreground">{variant.qc.issues.join(' · ')}</p> : null}
                  </div>
                ) : null}
                {variant.downloadUrl ? (
                  <a href={variant.downloadUrl} download data-testid="ad-studio-download-image" className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                    Download still
                  </a>
                ) : null}
                {mode === 'image_to_ad' && (variant.status === 'ready' || variant.status === 'failed') ? (
                  <button type="button" data-testid="ad-studio-regenerate-still" disabled={busy} className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50" onClick={() => onRegenerate(variant)}>
                    {busy ? 'Regenerating…' : 'Regenerate this still'}
                  </button>
                ) : null}
                {variant.status === 'ready' ? (
                  <button type="button" data-testid="ad-studio-make-commercial" disabled={busy} className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" onClick={() => onCommercial(variant)}>
                    {mode === 'image_to_ad' ? 'Animate → 15s commercial' : 'Make commercial from image ad'}
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function HistoryPanel({
  runs,
  busy,
  loading,
  unavailable,
  onOpen,
}: {
  runs: AdStudioRun[]
  busy: boolean
  loading: boolean
  unavailable: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div data-testid="ad-studio-history" className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Recent Ad Studio runs from the live backend.</p>
      {loading && runs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-background/50 px-4 py-8 text-center" data-testid="ad-studio-history-loading">
          <p className="text-sm font-medium">Loading history…</p>
          <p className="mt-1 text-xs text-muted-foreground">Checking recent Ad Studio runs.</p>
        </div>
      ) : unavailable && runs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <Clapperboard className="mx-auto size-5 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm font-medium">History is temporarily unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">Use Retry history above to reconnect without affecting any run.</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <Clapperboard className="mx-auto size-5 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm font-medium">No Ad Studio runs yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a Storyline or Image to ad run and it will appear here.</p>
        </div>
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
