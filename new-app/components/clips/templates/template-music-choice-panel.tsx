'use client'

import { useMemo, useState } from 'react'
import type { TemplateFamilyV1 } from '@/lib/clips/real-video-templates/sequence-contract'
import { analyzeTemplateMusicFile } from '@/lib/clips/real-video-templates/music-browser'
import { planTemplateMusic, type TemplateMusicDecisionV1 } from '@/lib/clips/real-video-templates/music-sequence'
import type { AuthoredMusicScheduleV1 } from '@/lib/clips/real-video-templates/music-timing'

/**
 * Batch 5 template-owned replacement control. Intended for the Batch 4 media picker;
 * deliberately does not import, mount or change Compact/full Timeline.
 */
export function TemplateMusicChoicePanel({
  family, musicUploadId, previewUrl, saved, originalSchedule, onAccept, onCancel,
}: {
  family: TemplateFamilyV1
  musicUploadId: string
  previewUrl?: string
  saved?: TemplateMusicDecisionV1
  originalSchedule?: AuthoredMusicScheduleV1
  onAccept: (decision: TemplateMusicDecisionV1) => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [rightsHolder, setRightsHolder] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [timing, setTiming] = useState<'beat-time' | 'fixed-time'>('beat-time')
  const [offsetFrames, setOffsetFrames] = useState(0)
  const [candidate, setCandidate] = useState<TemplateMusicDecisionV1 | undefined>(saved)
  const [choice, setChoice] = useState<'keep-timing' | 're-sync'>('keep-timing')
  const [acceptLoop, setAcceptLoop] = useState(false)
  const [manualTargets, setManualTargets] = useState<Record<string, number>>({})
  const [approvedTargets, setApprovedTargets] = useState<Record<string, boolean>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const decision: TemplateMusicDecisionV1 | undefined = candidate ? {
    ...candidate, choice, acceptLoop,
    schedule: {
      ...candidate.schedule,
      manualOverrides: [
        ...(candidate.schedule.manualOverrides ?? []),
        ...Object.entries(approvedTargets).filter(([,yes])=>yes).map(([id])=>({
          id, frame: manualTargets[id] ?? 0, approved: true as const,
        })),
      ],
    },
    ...(originalSchedule ? { originalSchedule } : {}),
  } : undefined
  const result = useMemo(() => {
    if (!decision) return null
    try { return { plan: planTemplateMusic(family, decision), error: '' } }
    catch (e) { return { plan: null, error: e instanceof Error ? e.message : 'Music timing unavailable' } }
  }, [family, decision])

  async function analyze() {
    if (!file) { setError('Select the exact uploaded music file for SHA-256 verification'); return }
    setError('')
    setAnalyzing(true)
    try {
      const verified = await analyzeTemplateMusicFile({
        file, registeredUploadId: musicUploadId, author: rightsHolder,
        userConfirmedRights: acknowledged, timing, offsetFrames,
      })
      setCandidate({ v: 1, ...verified })
    } catch (e) {
      setCandidate(undefined)
      setError(e instanceof Error ? e.message : 'Could not analyze this song')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Template soundtrack" data-testid="template-music-choice">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">Template soundtrack</h2>
        <p className="text-sm text-muted-foreground">
          Use music you own or can legally export. Timing is never changed without your approval.
        </p>
      </header>
      {previewUrl ? <audio controls preload="metadata" src={previewUrl} className="w-full" aria-label="Selected music preview" /> : null}
      {!saved ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Exact uploaded audio file</span>
            <input type="file" accept="audio/*" onChange={e => {setFile(e.currentTarget.files?.[0] ?? null);setCandidate(undefined)}}
              className="block w-full min-w-0 rounded-lg border border-border p-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Author or rights holder</span>
            <input value={rightsHolder} onChange={e=>setRightsHolder(e.target.value)} maxLength={150}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} className="mt-1" />
            I own this audio or have permission for commercial video exports and understand that uploading a viral song does not grant a license.
          </label>
          <label className="block text-sm">
            Timing policy
            <select value={timing} onChange={e=>setTiming(e.target.value as 'beat-time'|'fixed-time')}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2">
              <option value="beat-time">Detect and pin beat / phrase timing</option>
              <option value="fixed-time">Keep fixed-time cuts (works for silence / ambient music)</option>
            </select>
          </label>
          <label className="block text-sm">
            Music offset (output frames at 30 fps)
            <input type="number" step={1} value={offsetFrames} onChange={e=>setOffsetFrames(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2" />
          </label>
          <button type="button" disabled={analyzing || !file || !acknowledged || !rightsHolder.trim()}
            onClick={() => void analyze()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {analyzing ? 'Analyzing locally…' : 'Verify and pin music beats'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Using saved, content-hash-pinned beat schedule. Music is not reanalyzed on reopen.</p>
      )}
      {candidate ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground" data-testid="template-music-beats">
            {candidate.schedule.bpm != null ? candidate.schedule.bpm + ' BPM · ' : 'No beat tempo · '}
            {candidate.schedule.beats.length} pinned beats · SHA-256 {candidate.schedule.sha256.slice(0, 12)}…
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">When replacing the song</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="template-music-timing" checked={choice === 'keep-timing'} onChange={()=>setChoice('keep-timing')} />
              <span><strong>Keep edit timing</strong> — leave cuts, text and effects exactly where they are (default)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="template-music-timing" checked={choice === 're-sync'} onChange={()=>setChoice('re-sync')} />
              <span><strong>Re-sync to this music</strong> — move cuts and timed layers to the approved beat grid</span>
            </label>
          </fieldset>
          {choice === 're-sync' && originalSchedule?.protectedAnchors.length ? (
            <fieldset className="space-y-2 rounded-lg border border-border p-3">
              <legend className="text-sm font-medium">Protected beat/phrase anchors</legend>
              <p className="text-xs text-muted-foreground">
                Re-sync preserves each protected anchor. Approve a replacement frame explicitly; nothing is auto-moved around protected narration.
              </p>
              {originalSchedule.protectedAnchors.map(anchor => (
                <div key={anchor.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={approvedTargets[anchor.id] ?? false}
                      onChange={e=>setApprovedTargets(prev=>({...prev,[anchor.id]:e.target.checked}))} />
                    Approve {anchor.id} (old frame {anchor.frame})
                  </label>
                  <label className="flex items-center gap-2">
                    New frame
                    <input type="number" min={0} step={1} value={manualTargets[anchor.id] ?? ''}
                      onChange={e=>setManualTargets(prev=>({...prev,[anchor.id]:Number(e.target.value)}))}
                      aria-label={'Replacement frame for ' + anchor.id}
                      className="w-24 rounded-lg border border-border bg-background p-2" />
                  </label>
                </div>
              ))}
            </fieldset>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acceptLoop} onChange={e=>setAcceptLoop(e.target.checked)} />
            I approve looping the song if needed to cover the complete video
          </label>
          {result?.plan ? (
            <div className="space-y-1 rounded-lg border border-border p-3 text-sm" data-testid="template-music-resync-preview">
              <p>Original duration: {(result.plan.preview.oldDurationFrames / 30).toFixed(2)} s</p>
              <p>Proposed duration: {(result.plan.preview.newDurationFrames / 30).toFixed(2)} s</p>
              <p>Moved boundaries: {result.plan.preview.movedBoundaries}</p>
              <p>All text is retained unchanged; original source audio is not pitch-shifted.</p>
            </div>
          ) : null}
          {result?.error ? <p role="alert" className="text-sm text-destructive">{result.error}</p> : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
        <button type="button" disabled={!decision || !result?.plan || analyzing}
          onClick={()=>{if (decision && result?.plan) onAccept(decision)}}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          Accept music timing
        </button>
      </div>
    </section>
  )
}
