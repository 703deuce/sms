'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createT2vDraft, extractT2vUrl, patchT2vDraft, runT2vScript } from '@/lib/t2v/t2v-api'
import type { T2vAspect, T2vDraftV1 } from '@/lib/t2v/types'
import { splitScript } from '@/lib/t2v/split-script'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SourceTab = 'prompt' | 'script' | 'url'

const ASPECTS: T2vAspect[] = ['16:9', '9:16', '1:1', '4:5']
const LENGTHS: Array<30 | 60 | 90 | 120 | 180> = [30, 60, 90, 120, 180]

export function T2vCreateWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const draftId = params.get('d')
  const step = params.get('step') === '2' ? 2 : 1

  const [tab, setTab] = useState<SourceTab>('prompt')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [extractPreview, setExtractPreview] = useState<{ title: string; excerpt: string; text: string } | null>(null)
  const [aspect, setAspect] = useState<T2vAspect>('16:9')
  const [targetDurationS, setTargetDurationS] = useState<30 | 60 | 90 | 120 | 180>(60)
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState<T2vDraftV1['settings']['tone']>('friendly')
  const [loading, setLoading] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(false)

  const scriptEstimate = useMemo(() => {
    if (tab !== 'script' || !text.trim()) return null
    const scenes = splitScript(text, 'sentence')
    const words = text.trim().split(/\s+/).length
    const sec = Math.round((words / 2.5) * 10) / 10
    return { scenes: scenes.length, words, sec }
  }, [tab, text])

  const canContinue = tab === 'url' ? Boolean(extractPreview?.text?.trim()) : Boolean(text.trim())

  const onContinue = async () => {
    if (!canContinue) return
    setLoading(true)
    try {
      const sourceKind = tab === 'url' ? 'blog' : tab
      const payloadText = tab === 'url' ? extractPreview!.text : text
      const { id, projectId } = await createT2vDraft({
        sourceKind,
        text: payloadText,
        url: tab === 'url' ? url : undefined,
        settings: { aspect, targetDurationS },
      })
      router.push(`/app/clips/video/new?d=${id}&step=2&projectId=${projectId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create draft')
    } finally {
      setLoading(false)
    }
  }

  const onFetchUrl = async () => {
    if (!url.trim()) return
    setFetchingUrl(true)
    setExtractPreview(null)
    try {
      const data = await extractT2vUrl(url.trim())
      setExtractPreview({ title: data.title, excerpt: data.excerpt, text: data.text })
    } catch {
      toast.error("Couldn't read that page. Paste the text in Script instead.")
    } finally {
      setFetchingUrl(false)
    }
  }

  const onWriteScript = async () => {
    if (!draftId) return
    setLoading(true)
    try {
      const draft = await fetch(`/api/t2v/drafts/${draftId}`).then((r) => r.json())
      const doc = draft.data.document as T2vDraftV1
      const nextDoc: T2vDraftV1 = {
        ...doc,
        settings: { ...doc.settings, aspect, targetDurationS, tone, audience: audience || undefined },
      }
      await patchT2vDraft(draftId, draft.data.revision, nextDoc)
      await runT2vScript(draftId)
      const projectId = params.get('projectId') ?? draft.data.projectId
      router.push(`/app/clips/${projectId}/video?mode=script`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Script generation failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 2 && draftId) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Set up your video</h2>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Homeowners, small business…" />
          </div>
          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {(['friendly', 'professional', 'energetic', 'calm'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm capitalize',
                    tone === t ? 'border-primary bg-primary/10' : 'border-border',
                  )}
                  onClick={() => setTone(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Visuals</Label>
            <p className="text-sm text-muted-foreground">☑ Pixabay · ☐ Pexels (enable when keyed)</p>
          </div>
        </div>
        <aside className="space-y-4 rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Aspect {aspect} · ~{targetDurationS}s</p>
          <PrimaryButton className="w-full" disabled={loading} onClick={() => void onWriteScript()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Write script →
          </PrimaryButton>
        </aside>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Text to video</h1>
          <p className="text-sm text-muted-foreground">Idea, script, or link → finished video</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['prompt', 'script', 'url'] as SourceTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={cn('flex-1 rounded-md py-2 text-sm capitalize', tab === t && 'bg-muted font-medium')}
              onClick={() => setTab(t)}
            >
              {t === 'prompt' ? 'Idea' : t === 'url' ? 'URL / Blog' : 'Script'}
            </button>
          ))}
        </div>
        {tab === 'prompt' && (
          <Textarea rows={6} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="60-second explainer on how solar panels work…" />
        )}
        {tab === 'script' && (
          <>
            <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste narration…" />
            {scriptEstimate ? (
              <p className="text-xs text-muted-foreground">
                ≈ {scriptEstimate.scenes} scenes · ≈ {Math.floor(scriptEstimate.sec / 60)}:
                {String(Math.round(scriptEstimate.sec % 60)).padStart(2, '0')}
              </p>
            ) : null}
          </>
        )}
        {tab === 'url' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              <Button type="button" variant="secondary" disabled={fetchingUrl || !url.trim()} onClick={() => void onFetchUrl()}>
                {fetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
              </Button>
            </div>
            {extractPreview ? (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{extractPreview.title}</p>
                <p className="mt-2 text-muted-foreground">{extractPreview.excerpt}</p>
              </div>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {ASPECTS.map((a) => (
            <button
              key={a}
              type="button"
              className={cn('rounded-md border px-2 py-1 text-xs', aspect === a && 'border-primary')}
              onClick={() => setAspect(a)}
            >
              {a}
            </button>
          ))}
          {LENGTHS.map((s) => (
            <button
              key={s}
              type="button"
              className={cn('rounded-md border px-2 py-1 text-xs', targetDurationS === s && 'border-primary')}
              onClick={() => setTargetDurationS(s)}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>
      <aside className="space-y-4 rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Step 1 · Create</p>
        <PrimaryButton className="w-full" disabled={!canContinue || loading} onClick={() => void onContinue()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continue →
        </PrimaryButton>
      </aside>
    </div>
  )
}
