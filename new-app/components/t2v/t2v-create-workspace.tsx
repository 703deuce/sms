'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  applyT2vTemplate,
  createT2vDraft,
  extractT2vUrl,
  extractT2vAudio,
  patchT2vDraft,
  pollT2vDeckExtract,
  runT2vScript,
  startT2vDeckExtract,
} from '@/lib/t2v/t2v-api'
import { Dropzone } from '@/components/clips/dropzone'
import { uploadClipFile } from '@/lib/clips/upload'
import Link from 'next/link'
import type { T2vAspect, T2vDraftV1, T2vVoiceSettings } from '@/lib/t2v/types'
import { T2vCreateVoicePicker } from '@/components/t2v/t2v-create-voice-picker'
import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'
import { splitScript } from '@/lib/t2v/split-script'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SourceTab = 'prompt' | 'script' | 'url' | 'deck' | 'audio'

const ASPECTS: T2vAspect[] = ['16:9', '9:16', '1:1', '4:5']
const LENGTHS: Array<30 | 60 | 90 | 120 | 180> = [30, 60, 90, 120, 180]

export function T2vCreateWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const draftId = params.get('d')
  const templateId = params.get('template')
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
  const [deckUploadId, setDeckUploadId] = useState<string | null>(null)
  const [deckBusy, setDeckBusy] = useState(false)
  const [deckSlides, setDeckSlides] = useState<number | null>(null)
  const [audioUploadId, setAudioUploadId] = useState<string | null>(null)
  const [audioBusy, setAudioBusy] = useState(false)
  const [pexelsOn, setPexelsOn] = useState(false)
  const [platform, setPlatform] = useState<T2vDraftV1['settings']['platform']>('youtube')
  const [sceneSplit, setSceneSplit] = useState<T2vDraftV1['settings']['sceneSplit']>('sentence')
  const [voice, setVoice] = useState<T2vVoiceSettings>(DEFAULT_T2V_VOICE)
  const [writingScript, setWritingScript] = useState(false)

  useEffect(() => {
    void fetch('/api/t2v/config')
      .then((r) => r.json())
      .then((b) => setPexelsOn(Boolean(b.data?.pexels)))
      .catch(() => {})
  }, [])

  const scriptEstimate = useMemo(() => {
    if (tab !== 'script' || !text.trim()) return null
    const scenes = splitScript(text, 'sentence')
    const words = text.trim().split(/\s+/).length
    const sec = Math.round((words / 2.5) * 10) / 10
    return { scenes: scenes.length, words, sec }
  }, [tab, text])

  const canContinue =
    tab === 'url'
      ? Boolean(extractPreview?.text?.trim())
      : tab === 'deck'
        ? Boolean(deckSlides && text.trim())
        : tab === 'audio'
          ? Boolean(audioUploadId && text.trim())
          : Boolean(text.trim())

  const onContinue = async () => {
    if (!canContinue) return
    setLoading(true)
    try {
      const sourceKind =
        tab === 'url' ? 'blog' : tab === 'deck' ? 'ppt' : tab === 'audio' ? 'audio' : tab
      const payloadText = tab === 'url' ? extractPreview!.text : text
      const { id, projectId } = await createT2vDraft({
        sourceKind,
        text: payloadText,
        url: tab === 'url' ? url : undefined,
        uploadId: tab === 'deck' ? deckUploadId ?? undefined : tab === 'audio' ? audioUploadId ?? undefined : undefined,
        templateId: templateId ?? undefined,
        settings: { aspect, targetDurationS, platform, sceneSplit },
      })
      if (templateId) await applyT2vTemplate(templateId, id)
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
    if (!draftId || writingScript) return
    setWritingScript(true)
    setLoading(true)
    console.info('[t2v:script-generate] write script started', { draftId })
    try {
      const draft = await fetch(`/api/t2v/drafts/${draftId}`).then((r) => r.json())
      const doc = draft.data.document as T2vDraftV1
      const nextDoc: T2vDraftV1 = {
        ...doc,
        voice,
        settings: {
          ...doc.settings,
          aspect,
          targetDurationS,
          tone,
          audience: audience || undefined,
          platform,
          mediaSources: pexelsOn ? ['pixabay', 'pexels'] : ['pixabay'],
        },
      }
      await patchT2vDraft(draftId, draft.data.revision, nextDoc)
      await runT2vScript(draftId)
      console.info('[t2v:script-generate] write script completed', { draftId })
      const projectId = params.get('projectId') ?? draft.data.projectId
      router.push(`/app/clips/${projectId}/video?mode=script`)
    } catch (e) {
      console.error('[t2v:script-generate] write script failed', {
        draftId,
        message: e instanceof Error ? e.message : String(e),
      })
      toast.error(e instanceof Error ? e.message : 'Script generation failed')
    } finally {
      setLoading(false)
      setWritingScript(false)
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
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {(['youtube', 'youtube_shorts', 'tiktok', 'reels', 'linkedin', 'generic'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cn('rounded-full border px-2 py-1 text-xs', platform === p && 'border-primary')}
                  onClick={() => {
                    setPlatform(p)
                    if (p === 'youtube_shorts' || p === 'tiktok' || p === 'reels') setAspect('9:16')
                    if (p === 'linkedin') setAspect('1:1')
                  }}
                >
                  {p.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Visuals</Label>
            <p className="text-sm text-muted-foreground">
              ☑ Pixabay · {pexelsOn ? '☑ Pexels' : '☐ Pexels (not connected)'}
            </p>
          </div>
          <T2vCreateVoicePicker value={voice} onChange={setVoice} />
        </div>
        <aside className="space-y-4 rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Aspect {aspect} · ~{targetDurationS}s</p>
          <PrimaryButton className="w-full" disabled={loading || writingScript} onClick={() => void onWriteScript()}>
            {loading || writingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {writingScript ? 'Writing script…' : 'Write script →'}
          </PrimaryButton>
        </aside>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">AI Video</h1>
            <p className="text-sm text-muted-foreground">Idea, script, link, or deck → finished video</p>
          </div>
          <Link href="/app/clips/video/templates" className="text-sm text-primary">Browse templates</Link>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {(['prompt', 'script', 'url', 'deck', 'audio'] as SourceTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={cn('flex-1 rounded-md py-2 text-sm capitalize', tab === t && 'bg-muted font-medium')}
              onClick={() => setTab(t)}
            >
              {t === 'prompt'
                ? 'Idea'
                : t === 'url'
                  ? 'URL / Blog'
                  : t === 'deck'
                    ? 'PPT / PDF'
                    : t === 'audio'
                      ? 'Audio'
                      : 'Script'}
            </button>
          ))}
        </div>
        {tab === 'prompt' && (
          <Textarea rows={6} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="60-second explainer on how solar panels work…" />
        )}
        {tab === 'script' && (
          <>
            <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste narration…" />
            <div className="flex flex-wrap gap-2 text-xs">
              {(['sentence', 'line_break', 'ai'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn('rounded border px-2 py-1', sceneSplit === m && 'border-primary')}
                  onClick={() => setSceneSplit(m)}
                >
                  {m === 'ai' ? 'AI split' : m.replace('_', ' ')}
                </button>
              ))}
            </div>
            {scriptEstimate ? (
              <p className="text-xs text-muted-foreground">
                ≈ {scriptEstimate.scenes} scenes · ≈ {Math.floor(scriptEstimate.sec / 60)}:
                {String(Math.round(scriptEstimate.sec % 60)).padStart(2, '0')}
              </p>
            ) : null}
          </>
        )}
        {tab === 'audio' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">We transcribe your audio and build scenes from the words. Voice stays original.</p>
            <Dropzone
              onFile={(file) => {
                setAudioBusy(true)
                void uploadClipFile(file, (p) => {
                  if (p.state === 'complete' && p.uploadId) {
                    setAudioUploadId(p.uploadId)
                    void extractT2vAudio(p.uploadId)
                      .then((data) => {
                        setText(data.text)
                        toast.success('Transcript ready')
                      })
                      .catch(() => toast.error('Transcription failed — check Deepgram key'))
                      .finally(() => setAudioBusy(false))
                  }
                  if (p.state === 'error') setAudioBusy(false)
                }).catch(() => setAudioBusy(false))
              }}
            />
            {audioBusy ? <p className="text-sm text-muted-foreground">Transcribing…</p> : null}
          </div>
        )}
        {tab === 'deck' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Upload a PowerPoint or PDF deck — we extract slide text for your script.</p>
            <Dropzone
              onFile={(file) => {
                setDeckBusy(true)
                setDeckSlides(null)
                void uploadClipFile(file, (p) => {
                  if (p.state === 'complete' && p.uploadId) {
                    setDeckUploadId(p.uploadId)
                    void startT2vDeckExtract({ uploadId: p.uploadId })
                      .then(async ({ jobId }) => {
                        for (let i = 0; i < 40; i++) {
                          await new Promise((r) => setTimeout(r, 1500))
                          const st = await pollT2vDeckExtract(jobId)
                          const stNorm = st.status.toLowerCase()
                          if (stNorm === 'ready' || stNorm === 'succeeded' || stNorm === 'complete') {
                            const slides = st.result?.slides ?? []
                            setDeckSlides(slides.length)
                            setText(slides.map((s) => s.narration).filter(Boolean).join('\n\n'))
                            return
                          }
                          if (st.status === 'failed') throw new Error(st.error ?? 'extract_failed')
                        }
                        toast.message('Deck extraction is queued — Agent B worker will fill slides when ready')
                      })
                      .catch(() => toast.error('Could not extract deck yet'))
                      .finally(() => setDeckBusy(false))
                  }
                  if (p.state === 'error') setDeckBusy(false)
                }).catch(() => setDeckBusy(false))
              }}
            />
            {deckBusy ? <p className="text-sm text-muted-foreground">Extracting slides…</p> : null}
            {deckSlides != null ? (
              <p className="text-xs text-muted-foreground">{deckSlides} slides detected</p>
            ) : null}
          </div>
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
