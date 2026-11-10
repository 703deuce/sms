import { describe, expect, it } from 'vitest'
import {
  applyAiCaptionsStyle,
  createAiCaptionsRun,
  exportAiCaptionsRun,
  getAiCaptionsRun,
  getAiCaptionsSrt,
  listAiCaptionsStyles,
} from '@/lib/ai-captions/runs'
import { AiCaptionsError } from '@/lib/ai-captions/errors'
import { captionWordsCoverTranscript, linesCoverWords } from '@/lib/ai-captions/words'
import { longTalkingHeadWords, sourceMap, testDeps, wordsAt } from './helpers'

const shortWords = wordsAt([
  { w: 'Hello', s: 0, dur: 0.3 },
  { w: 'world,', s: 0.3, dur: 0.3 },
  { w: 'this', s: 0.6, dur: 0.25, p: 0.31 },
  { w: 'is', s: 0.9, dur: 0.2 },
  { w: 'fine.', s: 1.15, dur: 0.4 },
])

describe('ai-captions runs', () => {
  it('starts automatically from an existing project or asset and writes one full-video clip', async () => {
    const sources = sourceMap([
      { projectId: 'proj_ready', durationMs: 5_000, words: shortWords },
      { projectId: 'proj_ready', assetId: 'asset_1', durationMs: 5_000, words: shortWords },
    ])
    const uploadDeps = testDeps({ sources })
    const created = await createAiCaptionsRun(
      'ws_1',
      null,
      { clientRequestId: 'req-up', source: { kind: 'project', projectId: 'proj_ready' } },
      null,
      uploadDeps,
    )
    expect(created.created).toBe(true)
    expect(created.view.status).toBe('ready')
    expect(created.view.creditEstimate).toBe(10)

    const view = await getAiCaptionsRun('ws_1', created.view.runId, uploadDeps)
    expect(view.result).toBeTruthy()
    expect(view.result!.bounds).toEqual({ startMs: 0, endMs: 5_000 })
    expect(view.result!.captionsEnabled).toBe(true)
    expect(view.result!.styleId).toBe('clean_white')
    expect(view.result!.editorUrl).toBe(`/app/video-editor/proj_ready/edit/${view.result!.clipId}?tab=captions`)
    expect(view.result!.srtUrl).toBe(`/api/ai-captions/runs/${view.runId}/srt`)
    const clip = uploadDeps.clips.get(view.result!.clipId)!
    expect(clip.edits.captions?.enabled).toBe(true)
    expect(clip.edits.captions?.presetId).toBe('clean_white')
    expect(clip.edits.captions?.keywordHighlight).toBe(false)
    expect(clip.edits.captions?.autoEmojis).toBe(false)
    expect(clip.edits.captionLines?.length).toBeGreaterThan(0)

    const assetDeps = testDeps({ sources })
    const asset = await createAiCaptionsRun(
      'ws_1',
      null,
      { clientRequestId: 'req-asset', source: { kind: 'asset', projectId: 'proj_ready', assetId: 'asset_1' } },
      'req-asset',
      assetDeps,
    )
    const assetView = await getAiCaptionsRun('ws_1', asset.view.runId, assetDeps)
    expect(assetView.result!.words.map((w) => w.text)).toEqual(view.result!.words.map((w) => w.text))
    expect(assetView.result!.lines.map((l) => l.text)).toEqual(view.result!.lines.map((l) => l.text))
    expect(assetView.result!.bounds).toEqual(view.result!.bounds)
  })

  it('is idempotent, flags low-confidence words, and serves SRT from the same lines', async () => {
    const deps = testDeps({
      sources: sourceMap([{ projectId: 'proj_ready', durationMs: 5_000, words: shortWords }]),
    })
    const body = { clientRequestId: 'req-idem', source: { kind: 'project' as const, projectId: 'proj_ready' } }
    const first = await createAiCaptionsRun('ws_1', null, body, null, deps)
    const replay = await createAiCaptionsRun('ws_1', null, body, 'req-idem', deps)
    expect(replay.created).toBe(false)
    expect(replay.view.runId).toBe(first.view.runId)

    await expect(
      createAiCaptionsRun(
        'ws_1',
        null,
        { clientRequestId: 'req-idem', source: { kind: 'project', projectId: 'proj_ready' }, styleId: 'minimal' },
        null,
        deps,
      ),
    ).rejects.toMatchObject({ code: 'idempotency_key_reuse', status: 409 })

    await expect(createAiCaptionsRun('ws_1', null, { source: { kind: 'project', projectId: 'proj_ready' } }, null, deps)).rejects.toMatchObject({
      code: 'idempotency_key_required',
      status: 400,
    })

    const view = await getAiCaptionsRun('ws_1', first.view.runId, deps)
    const flagged = view.result!.words.filter((w) => w.lowConfidence)
    expect(flagged.map((w) => w.text)).toEqual(['this'])
    expect(flagged[0]?.confidence).toBe(0.31)
    expect(view.result!.words.find((w) => w.text === 'Hello')?.lowConfidence).toBe(false)
    expect(view.result!.words.find((w) => w.text === 'Hello')?.confidence).toBeUndefined()

    const srt = await getAiCaptionsSrt('ws_1', first.view.runId, deps)
    for (const line of view.result!.lines) {
      expect(srt).toContain(line.text)
    }
    expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> /)

    const exported = await exportAiCaptionsRun('ws_1', first.view.runId, deps)
    expect(exported.queued).toBe(true)
    expect(exported.view.result!.downloadUrl).toContain('.mp4')
    expect(deps.lastExportWatermark).toBe(false)
    const again = await exportAiCaptionsRun('ws_1', first.view.runId, deps)
    expect(again.queued).toBe(false)
    expect(JSON.stringify(view)).not.toContain('$')
  })

  it('covers every transcript word on a 25-minute source and reapplies a saved style', async () => {
    const words = longTalkingHeadWords()
    const durationMs = 25 * 60 * 1000
    expect(durationMs).toBeGreaterThanOrEqual(20 * 60 * 1000)
    const lastMs = Math.round(words[words.length - 1]!.e * 1000)
    expect(lastMs).toBeGreaterThanOrEqual(24 * 60 * 1000)

    const saved = [
      {
        styleId: 'cpre_saved_clean',
        name: 'My clean',
        basePresetId: 'clean_white',
        config: { presetId: 'minimal', keywordHighlight: true },
      },
    ]
    const deps = testDeps({
      sources: sourceMap([{ projectId: 'proj_long', durationMs, words }]),
      saved,
    })
    const created = await createAiCaptionsRun(
      'ws_1',
      null,
      { clientRequestId: 'req-long', source: { kind: 'project', projectId: 'proj_long' } },
      null,
      deps,
    )
    const view = await getAiCaptionsRun('ws_1', created.view.runId, deps)
    const coverage = captionWordsCoverTranscript(words, view.result!.words)
    expect(coverage.ok).toBe(true)
    expect(coverage.missing).toEqual([])
    expect(linesCoverWords(view.result!.words, view.result!.lines)).toBe(true)
    expect(view.result!.words.some((w) => w.lowConfidence)).toBe(true)
    expect(view.result!.durationMs).toBe(durationMs)

    const styles = await listAiCaptionsStyles('ws_1', deps)
    expect(styles.defaultStyleId).toBe('clean_white')
    expect(styles.lastStyleId).toBe('clean_white')
    expect(styles.styles).toHaveLength(15)
    expect(styles.styles.some((s) => s.styleId === 'cpre_saved_clean' && s.kind === 'saved')).toBe(true)

    const applied = await applyAiCaptionsStyle(
      'ws_1',
      created.view.runId,
      { styleId: 'cpre_saved_clean' },
      deps,
    )
    expect(applied.result!.styleId).toBe('cpre_saved_clean')
    const clip = deps.clips.get(applied.result!.clipId)!
    expect(clip.edits.captions?.customPresetId).toBe('cpre_saved_clean')
    expect(clip.edits.captions?.keywordHighlight).toBe(true)
    expect(clip.edits.captions?.autoEmojis).toBe(false)
    const after = await listAiCaptionsStyles('ws_1', deps)
    expect(after.lastStyleId).toBe('cpre_saved_clean')

    const same = await applyAiCaptionsStyle('ws_1', created.view.runId, { styleId: 'cpre_saved_clean' }, deps)
    expect(same.result!.styleId).toBe('cpre_saved_clean')

    clip.edits.captionLines = (clip.edits.captionLines ?? []).map((line, i) =>
      i === 0 ? { ...line, text: 'Edited line', startMs: line.startMs, endMs: line.endMs } : line,
    )
    expect(clip.edits.captionLines[0]?.text).toBe('Edited line')

    await expect(applyAiCaptionsStyle('ws_1', created.view.runId, { styleId: 'nope' }, deps)).rejects.toMatchObject({
      code: 'unknown_style_id',
    })
  })

  it('accepts kind upload with uploadId, stays preparing until the transcript is ready, then captions', async () => {
    const pending = sourceMap([
      {
        projectId: 'proj_from_upl_1',
        uploadId: 'upl_1',
        durationMs: 5_000,
        words: shortWords,
        wordsPending: true,
        ready: false,
      },
    ])
    const deps = testDeps({ sources: pending })
    const created = await createAiCaptionsRun(
      'ws_1',
      null,
      { clientRequestId: 'req-upl', source: { kind: 'upload', uploadId: 'upl_1' } },
      null,
      deps,
    )
    expect(created.created).toBe(true)
    expect(created.view.status).toBe('preparing')
    const mid = await getAiCaptionsRun('ws_1', created.view.runId, deps)
    // After ingestion, a pending transcript advances to the distinct transcription stage.
    expect(['preparing', 'transcribing']).toContain(mid.status)
    expect(mid.projectId).toBe('proj_from_upl_1')
    expect(mid.result).toBeNull()

    const source = pending.get('upload:upl_1')!
    source.wordsPending = false
    source.ready = true

    const ready = await getAiCaptionsRun('ws_1', created.view.runId, deps)
    expect(ready.status).toBe('ready')
    expect(ready.result!.projectId).toBe('proj_from_upl_1')
    expect(ready.result!.bounds.startMs).toBe(0)
    expect(ready.result!.captionsEnabled).toBe(true)
    expect(ready.result!.editorUrl).toContain('/app/video-editor/proj_from_upl_1/edit/')
    expect(ready.result!.editorUrl).toContain('?tab=captions')
  })

  it('rejects a source that is not ready and a missing idempotency collision is not a dollar error'
, async () => {
    const deps = testDeps({
      sources: sourceMap([{ projectId: 'proj_draft', durationMs: 5_000, words: shortWords, ready: false }]),
    })
    try {
      await createAiCaptionsRun(
        'ws_1',
        null,
        { clientRequestId: 'req-draft', source: { kind: 'project', projectId: 'proj_draft' } },
        null,
        deps,
      )
      throw new Error('expected failure')
    } catch (err) {
      expect(err).toBeInstanceOf(AiCaptionsError)
      expect((err as AiCaptionsError).code).toBe('source_not_ready')
      expect((err as AiCaptionsError).message).not.toContain('$')
    }
  })
  it('waits for the actual burned-in render and downloads only after the render is ready', async () => {
    const deps = testDeps({ sources: sourceMap([{ projectId: 'proj_export', durationMs: 5_000, words: shortWords }]) })
    const created = await createAiCaptionsRun('ws_1', null,
      { clientRequestId: 'req-delayed-export', source: { kind: 'project', projectId: 'proj_export' } },
      null, deps)
    deps.pipeline.exportMp4 = async () => ({ downloadUrl: null, renderId: 'rnd_delayed' })
    let ready = false
    deps.pipeline.pollExport = async () => ready
      ? { status: 'ready', downloadUrl: 'https://example.test/finished.mp4' }
      : { status: 'processing', downloadUrl: null }
    const queued = await exportAiCaptionsRun('ws_1', created.view.runId, deps)
    expect(queued.view.status).toBe('exporting')
    expect(queued.view.result?.downloadUrl).toBeNull()
    const pending = await getAiCaptionsRun('ws_1', created.view.runId, deps)
    expect(pending.status).toBe('exporting')
    ready = true
    const completed = await getAiCaptionsRun('ws_1', created.view.runId, deps)
    expect(completed.status).toBe('ready')
    expect(completed.result?.downloadUrl).toBe('https://example.test/finished.mp4')
  })

  it('invalidates an earlier MP4 when the clip editor saves caption changes', async () => {
    const deps = testDeps({ sources: sourceMap([{ projectId: 'proj_edits', durationMs: 5_000, words: shortWords }]) })
    let version = 1
    deps.pipeline.getEditsVersion = async () => version
    const created = await createAiCaptionsRun('ws_1', null,
      { clientRequestId: 'req-edits-version', source: { kind: 'project', projectId: 'proj_edits' } },
      null, deps)
    const first = await exportAiCaptionsRun('ws_1', created.view.runId, deps)
    expect(first.view.result?.exportedEditsVersion).toBe(1)
    expect(first.view.result?.downloadUrl).toContain('.mp4')
    version = 2
    const edited = await getAiCaptionsRun('ws_1', created.view.runId, deps)
    expect(edited.result?.downloadUrl).toBeNull()
    const second = await exportAiCaptionsRun('ws_1', created.view.runId, deps)
    expect(second.view.result?.exportedEditsVersion).toBe(2)
  })

  it('shows a clear no-speech error rather than polling a completed empty transcript forever', async () => {
    const deps = testDeps({ sources: sourceMap([{ projectId: 'proj_silent', uploadId: 'upl_silent', durationMs: 5000, ready: true, words: [] }]) })
    await expect(createAiCaptionsRun('ws_1', null,
      { clientRequestId: 'req-silent', source: { kind: 'upload', uploadId: 'upl_silent' } },
      null, deps)).rejects.toMatchObject({ code: 'source_has_no_audio' })
  })

})
