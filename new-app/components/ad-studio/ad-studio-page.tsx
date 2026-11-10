"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clapperboard, ImageIcon, Sparkles } from "lucide-react"
import { createMockAdStudioClient } from "../../lib/ad-studio/mock-client"
import { formatCredits, sanitizeAdStudioMessage, statusLabel } from "../../lib/ad-studio/format"
import { estimateCredits } from "../../lib/ad-studio/costs"
import type { AdStudioClient } from "../../lib/ad-studio/client"
import type {
  AdProductInput,
  AdStudioAspect,
  AdStudioDurationSec,
  AdStudioHistoryItem,
  AdStudioMode,
  AdStudioRun,
} from "../../lib/ad-studio/types"
import { AdStudioHttpError, AD_STUDIO_ASPECTS, AD_STUDIO_DURATIONS } from "../../lib/ad-studio/types"
import { cn } from "../../lib/utils"

type Screen = "home" | "brief" | "run" | "history"

type Props = {
  client?: AdStudioClient
  sleep?: (ms: number) => Promise<void>
  pollMs?: number
}

const DEFAULT_INPUT: AdProductInput = {
  name: "",
  url: "",
  sellingPoints: [""],
  audience: "",
  brandNotes: "",
  aspect: "9:16",
  durationSec: 15,
  imageAssetIds: [],
}

export function AdStudioPage({
  client = createMockAdStudioClient(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  pollMs = 40,
}: Props) {
  const [screen, setScreen] = useState<Screen>("home")
  const [mode, setMode] = useState<AdStudioMode>("storyline")
  const [input, setInput] = useState<AdProductInput>(DEFAULT_INPUT)
  const [run, setRun] = useState<AdStudioRun | null>(null)
  const [history, setHistory] = useState<AdStudioHistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID())
  const [confirmKey, setConfirmKey] = useState(() => crypto.randomUUID())
  const estimate = useMemo(() => estimateCredits(mode, input.durationSec), [mode, input.durationSec])

  const refreshHistory = useCallback(async () => {
    const items = await client.listHistory()
    setHistory(items)
  }, [client])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    if (!run) return
    if (run.status !== "planning" && run.status !== "generating" && run.status !== "stitching") return
    let cancelled = false
    void (async () => {
      await sleep(pollMs)
      if (cancelled) return
      try {
        const next = await client.getRun(run.id)
        if (!cancelled) setRun(next)
      } catch (err) {
        if (!cancelled) setError(messageOf(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client, pollMs, run, sleep])

  function openMode(next: AdStudioMode) {
    setMode(next)
    setInput({ ...DEFAULT_INPUT, imageAssetIds: next === "image_to_ad" ? [] : DEFAULT_INPUT.imageAssetIds })
    setRun(null)
    setError(null)
    setCreateKey(crypto.randomUUID())
    setConfirmKey(crypto.randomUUID())
    setScreen("brief")
  }

  async function submitBrief() {
    if (busy) return
    setBusy(true)
    setError(null)
    const body: AdProductInput = {
      ...input,
      name: input.name.trim(),
      sellingPoints: input.sellingPoints.map((p) => p.trim()).filter(Boolean),
      url: input.url?.trim() || undefined,
      audience: input.audience?.trim() || undefined,
      brandNotes: input.brandNotes?.trim() || undefined,
    }
    try {
      const created = await client.createRun({ mode, input: body, idempotencyKey: createKey })
      const next = await client.getRun(created.id)
      setRun(next)
      setScreen("run")
      await refreshHistory()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmPlan() {
    if (!run || run.status !== "plan_ready" || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await client.confirm(run.id, confirmKey)
      setRun(next)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function replan() {
    if (!run || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await client.replan(run.id)
      setRun(next)
      setConfirmKey(crypto.randomUUID())
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function cancelRun() {
    if (!run || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await client.cancel(run.id)
      setRun(next)
      await refreshHistory()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  const confirmEnabled = run?.status === "plan_ready" && !busy

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[32rem] flex-col bg-background" data-testid="ad-studio-shell">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Product ad"
          data-testid="ad-studio-nav"
          className="flex w-full shrink-0 flex-col gap-3 border-b border-border bg-card/60 px-3 py-4 md:w-52 md:border-r md:border-b-0"
        >
          <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Product ad</p>
          <NavBtn testId="ad-studio-nav-storyline" active={screen !== "history" && mode === "storyline"} onClick={() => openMode("storyline")} icon={Sparkles} label="Storyline" />
          <NavBtn testId="ad-studio-nav-image-to-ad" active={screen !== "history" && mode === "image_to_ad"} onClick={() => openMode("image_to_ad")} icon={ImageIcon} label="Image to ad" />
          <NavBtn testId="ad-studio-nav-history" active={screen === "history"} onClick={() => { setScreen("history"); void refreshHistory() }} icon={Clapperboard} label="History" />
        </nav>
        <main className="min-w-0 flex-1 overflow-auto p-5" data-testid="ad-studio-main">
          {error ? (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert" data-testid="ad-studio-error">
              {error}
            </p>
          ) : null}
          {screen === "home" ? <ModeHome onSelect={openMode} /> : null}
          {screen === "brief" ? (
            <BriefForm
              mode={mode}
              input={input}
              estimate={estimate}
              busy={busy}
              onChange={setInput}
              onSubmit={() => void submitBrief()}
            />
          ) : null}
          {screen === "run" && run ? (
            <RunPanel
              run={run}
              confirmEnabled={confirmEnabled}
              busy={busy}
              onConfirm={() => void confirmPlan()}
              onReplan={() => void replan()}
              onCancel={() => void cancelRun()}
            />
          ) : null}
          {screen === "history" ? <HistoryPanel items={history} /> : null}
        </main>
      </div>
    </div>
  )
}

function messageOf(err: unknown): string {
  if (err instanceof AdStudioHttpError) return sanitizeAdStudioMessage(err.message)
  if (err instanceof Error) return sanitizeAdStudioMessage(err.message)
  return "Something went wrong"
}

function NavBtn({
  testId,
  active,
  onClick,
  icon: Icon,
  label,
}: {
  testId: string
  active: boolean
  onClick: () => void
  icon: typeof Sparkles
  label: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  )
}

function ModeHome({ onSelect }: { onSelect: (mode: AdStudioMode) => void }) {
  return (
    <div data-testid="ad-studio-mode-home" className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-foreground">Product ad</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Build a short product ad. Agents pick the models. You review the plan before any generation credits are used.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          data-testid="ad-studio-mode-storyline"
          className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelect("storyline")}
        >
          <p className="text-sm font-medium">Storyline</p>
          <p className="mt-1 text-xs text-muted-foreground">Hook, problem, solution, and CTA. Mixes stock B-roll with short AI shots.</p>
        </button>
        <button
          type="button"
          data-testid="ad-studio-mode-image-to-ad"
          className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelect("image_to_ad")}
        >
          <p className="text-sm font-medium">Image to ad</p>
          <p className="mt-1 text-xs text-muted-foreground">One product photo becomes a 15 or 30 second ad.</p>
        </button>
      </div>
    </div>
  )
}

function BriefForm({
  mode,
  input,
  estimate,
  busy,
  onChange,
  onSubmit,
}: {
  mode: AdStudioMode
  input: AdProductInput
  estimate: number | null
  busy: boolean
  onChange: (input: AdProductInput) => void
  onSubmit: () => void
}) {
  const needsImage = mode === "image_to_ad"
  const canSubmit = input.name.trim().length > 0 && (!needsImage || input.imageAssetIds.length > 0) && !busy
  return (
    <form
      data-testid="ad-studio-brief"
      className="mx-auto flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit()
      }}
    >
      <h1 className="text-xl font-semibold">{mode === "storyline" ? "Storyline brief" : "Image-to-ad brief"}</h1>
      <label className="text-sm font-medium">
        Product name
        <input
          data-testid="ad-studio-product-name"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={input.name}
          onChange={(e) => onChange({ ...input, name: e.target.value })}
          required
        />
      </label>
      <label className="text-sm font-medium">
        Selling points
        <input
          data-testid="ad-studio-selling-points"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={input.sellingPoints[0] ?? ""}
          onChange={(e) => onChange({ ...input, sellingPoints: [e.target.value] })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Length
          <select
            data-testid="ad-studio-duration"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={input.durationSec}
            onChange={(e) => onChange({ ...input, durationSec: Number(e.target.value) as AdStudioDurationSec })}
          >
            {AD_STUDIO_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Aspect
          <select
            data-testid="ad-studio-aspect"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={input.aspect}
            onChange={(e) => onChange({ ...input, aspect: e.target.value as AdStudioAspect })}
          >
            {AD_STUDIO_ASPECTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>
      {needsImage ? (
        <label className="text-sm font-medium">
          Product image
          <input
            data-testid="ad-studio-product-image"
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0]
              onChange({
                ...input,
                imageAssetIds: file ? ["asset_local_1"] : [],
              })
            }}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {input.imageAssetIds.length ? "Image attached for this mock plan." : "Required for image-to-ad. The file stays local in this preview."}
          </span>
        </label>
      ) : null}
      <p className="text-sm text-muted-foreground" data-testid="ad-studio-credit-estimate">
        {formatCredits(estimate)}
      </p>
      <button
        type="submit"
        data-testid="ad-studio-plan-cta"
        disabled={!canSubmit}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Planning…" : "Get plan"}
      </button>
    </form>
  )
}

function RunPanel({
  run,
  confirmEnabled,
  busy,
  onConfirm,
  onReplan,
  onCancel,
}: {
  run: AdStudioRun
  confirmEnabled: boolean
  busy: boolean
  onConfirm: () => void
  onReplan: () => void
  onCancel: () => void
}) {
  const plan = run.plan
  const credits = formatCredits(run.creditEstimate ?? plan?.creditEstimate)
  if (run.status === "done") {
    return (
      <div data-testid="ad-studio-done" className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold">Ad ready</h1>
        <p className="mt-1 text-sm text-muted-foreground">{run.input.name} · {credits}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={run.compactEditorUrl ?? "#"}
            data-testid="ad-studio-open-compact-editor"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Open in editor
          </Link>
          <Link
            href={run.fullEditorUrl ?? "#"}
            data-testid="ad-studio-open-full-editor"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Switch to full editor
          </Link>
        </div>
      </div>
    )
  }
  if (run.status === "generating" || run.status === "stitching" || run.status === "confirming") {
    return (
      <div data-testid="ad-studio-progress" className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold">{statusLabel(run.status)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{credits}</p>
        <ul className="mt-4 space-y-2" data-testid="ad-studio-scene-progress">
          {(plan?.scenes ?? []).map((scene) => (
            <li key={scene.index} className="rounded-md border border-border px-3 py-2 text-sm" data-scene-index={scene.index}>
              <span className="font-medium capitalize">{scene.role}</span>
              {" · "}
              {scene.source}
              {" · "}
              {scene.status ?? "planned"}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <button type="button" data-testid="ad-studio-cancel" className="rounded-md border border-border px-3 py-2 text-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    )
  }
  return (
    <div data-testid="ad-studio-plan" className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">{run.status === "planning" ? "Planning…" : "Plan"}</h1>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="ad-studio-plan-credits">
        {credits}
      </p>
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
        <p className="mt-4 text-sm text-muted-foreground">Building a plan. Confirm stays off until it is ready.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="ad-studio-confirm"
          disabled={!confirmEnabled}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          onClick={onConfirm}
        >
          Confirm
        </button>
        <button
          type="button"
          data-testid="ad-studio-replan"
          disabled={busy || (run.status !== "plan_ready" && run.status !== "draft")}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
          onClick={onReplan}
        >
          Re-plan
        </button>
      </div>
    </div>
  )
}

function HistoryPanel({ items }: { items: AdStudioHistoryItem[] }) {
  return (
    <div data-testid="ad-studio-history" className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Prior studio jobs stay visible here.</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No prior jobs yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id} data-testid="ad-studio-history-item" className="px-4 py-3 text-sm">
              <span className="font-medium">{item.title}</span>
              <span className="ml-2 text-muted-foreground">{statusLabel(item.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
