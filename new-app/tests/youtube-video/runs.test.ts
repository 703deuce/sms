import { describe, expect, it } from 'vitest'
import { chooseYoutubeVideoOption, createYoutubeVideoRun, getYoutubeVideoRun, revertYoutubeVideoRun } from '@/lib/youtube-video/runs'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import { podcastScript, sourceFromWords, testDeps } from './helpers'

describe('youtube-video runs', () => {
  it('creates from an upload, waits for a choice, then writes one clip result', async () => {
    const source = sourceFromWords('proj_ready', podcastScript, 'Interview')
    const deps = testDeps(new Map([['proj_ready', source]]))
    // Two genuine options require a user choice; one option auto-selects.
    deps.pipeline.proposeOptions = () => [
      {
        id: 'opt_first', title: 'First story', premise: 'A coherent beginning and ending',
        beats: [
          { label: 'Opening', sourceId: 'proj_ready', startMs: 0, endMs: 6000 },
          { label: 'Ending', sourceId: 'proj_ready', startMs: 36000, endMs: 43000 },
        ],
      },
      {
        id: 'opt_second', title: 'Second story', premise: 'Another story',
        beats: [{ label: 'Moment', sourceId: 'proj_ready', startMs: 16000, endMs: 24000 }],
      },
    ]
    const created = await createYoutubeVideoRun(
      'ws_1',
      null,
      { sources: [{ kind: 'upload', projectId: 'proj_ready' }], clientRequestId: 'client-key-10' },
      null,
      deps,
    )
    expect(created.created).toBe(true)
    expect(created.view.status).toBe('awaiting_choice')
    expect(created.view.options?.length).toBeGreaterThan(0)
    expect(created.view.result).toBeNull()
    const optionId = created.view.options![0]!.id
    const chosen = await chooseYoutubeVideoOption('ws_1', created.view.runId, optionId, deps)
    expect(chosen.status).toBe('ready')
    expect(chosen.result?.clipId).toBe('clip_out')
    expect(chosen.result?.editorUrl).toBe('/app/clips/proj_out/edit/clip_out')
    expect(chosen.result?.plan.premise).toBeTruthy()
    expect(chosen.result?.plan.beats[0]?.label).toBeTruthy()
    expect(chosen.result?.chapters[0]).toEqual(expect.objectContaining({ title: expect.any(String), startMs: 0 }))
    expect(chosen.result?.chapterText).toContain(chosen.result!.chapters[0]!.title)
    expect(chosen.options).toBeNull()
    const again = await chooseYoutubeVideoOption('ws_1', created.view.runId, optionId, deps)
    expect(again.status).toBe('ready')
    const other = created.view.options![1]?.id
    if (other) {
      await expect(chooseYoutubeVideoOption('ws_1', created.view.runId, other, deps)).rejects.toMatchObject({
        code: 'option_already_chosen',
        status: 409,
      })
    }
    const gotten = await getYoutubeVideoRun('ws_1', created.view.runId, deps)
    expect(gotten.result?.plan).toEqual(chosen.result?.plan)
    const reverted = await revertYoutubeVideoRun('ws_1', created.view.runId, deps)
    expect(reverted.status).toBe('ready')
    expect(reverted.result?.clipId).toBe('clip_out')
  })

  it('replays the same create key and rejects a different body', async () => {
    const source = sourceFromWords('proj_ready', podcastScript)
    const deps = testDeps(new Map([['proj_ready', source]]))
    const first = await createYoutubeVideoRun(
      'ws_1',
      null,
      { sources: [{ kind: 'upload', projectId: 'proj_ready' }] },
      'client-key-11',
      deps,
    )
    const replay = await createYoutubeVideoRun(
      'ws_1',
      null,
      { sources: [{ kind: 'upload', projectId: 'proj_ready' }] },
      'client-key-11',
      deps,
    )
    expect(replay.created).toBe(false)
    expect(replay.view.runId).toBe(first.view.runId)
    await expect(createYoutubeVideoRun(
      'ws_1',
      null,
      { sources: [{ kind: 'upload', projectId: 'proj_other' }] },
      'client-key-11',
      deps,
    )).rejects.toMatchObject({ code: 'idempotency_key_reuse', status: 409 })
  })

  it('imports a mocked URL, then uses the exact same pipeline as an upload', async () => {
    const ingested = sourceFromWords('proj_from_url', podcastScript)
    let imported = 0
    const deps = testDeps(new Map([['proj_from_url', ingested], ['proj_ready', ingested]]), {
      importer: async ({ url }) => {
        imported += 1
        expect(url).toBe('https://www.twitch.tv/videos/999')
        return { projectId: 'proj_from_url' }
      },
    })
    const fromUrl = await createYoutubeVideoRun(
      'ws_url',
      null,
      { sources: [{ kind: 'url', url: 'https://www.twitch.tv/videos/999' }], clientRequestId: 'client-key-url' },
      null,
      deps,
    )
    expect(imported).toBe(1)
    const fromUpload = await createYoutubeVideoRun(
      'ws_up',
      null,
      { sources: [{ kind: 'upload', projectId: 'proj_from_url' }], clientRequestId: 'client-key-up' },
      null,
      deps,
    )
    expect(fromUrl.view.status).toBe('ready')
    expect(fromUpload.view.status).toBe('ready')
    expect(fromUrl.view.options).toBeNull()
    expect(fromUpload.view.options).toBeNull()
    expect(fromUrl.view.result?.plan.premise).toEqual(fromUpload.view.result?.plan.premise)
    expect(fromUrl.view.result?.plan.beats).toEqual(fromUpload.view.result?.plan.beats)
  })

  it('waits instead of returning HTTP 400, then advances when an upload becomes READY', async () => {
    const ready = new Map<string, ReturnType<typeof sourceFromWords>>()
    const deps = testDeps(ready)
    const created = await createYoutubeVideoRun(
      'ws_wait', null,
      { sources: [{ kind: 'upload', projectId: 'proj_pending' }], clientRequestId: 'req_wait_upload' },
      null, deps,
    )
    expect(created.created).toBe(true)
    expect(created.view.status).toBe('waiting_for_source')
    expect(created.view.stage).toBe('waiting_for_source')
    expect((await getYoutubeVideoRun('ws_wait', created.view.runId, deps)).status).toBe('waiting_for_source')
    ready.set('proj_pending', sourceFromWords('proj_pending', podcastScript))
    const advanced = await getYoutubeVideoRun('ws_wait', created.view.runId, deps)
    expect(advanced.status).toBe('ready')
    expect(advanced.result?.clipId).toBe('clip_out')
    expect((await getYoutubeVideoRun('ws_wait', created.view.runId, deps)).result).toEqual(advanced.result)
  })

  it('imports a URL only once while its project is transcribing', async () => {
    const ready = new Map<string, ReturnType<typeof sourceFromWords>>()
    let imports = 0
    const deps = testDeps(ready, {
      importer: async () => {
        imports += 1
        return { projectId: 'proj_imported_pending' }
      },
    })
    const created = await createYoutubeVideoRun(
      'ws_pending_url', null,
      { sources: [{ kind: 'url', url: 'https://www.twitch.tv/videos/123' }], clientRequestId: 'req_url_pending' },
      null, deps,
    )
    expect(created.view.status).toBe('waiting_for_source')
    await getYoutubeVideoRun('ws_pending_url', created.view.runId, deps)
    await getYoutubeVideoRun('ws_pending_url', created.view.runId, deps)
    expect(imports).toBe(1)
    ready.set('proj_imported_pending', sourceFromWords('proj_imported_pending', podcastScript))
    expect((await getYoutubeVideoRun('ws_pending_url', created.view.runId, deps)).status).toBe('ready')
    expect(imports).toBe(1)
  })
  it('auto-selects the only supported story without asking the viewer to choose', async () => {
    const source = sourceFromWords('proj_one', podcastScript)
    const deps = testDeps(new Map([['proj_one', source]]))
    deps.pipeline.proposeOptions = () => [{
      id: 'opt_solo',
      title: 'One truthful story',
      premise: 'A source-grounded story',
      beats: [{ label: 'Beginning', sourceId: 'proj_one', startMs: 0, endMs: 6000 }],
    }]
    const run = await createYoutubeVideoRun(
      'ws_solo', null,
      { sources: [{ kind: 'upload', projectId: 'proj_one' }], clientRequestId: 'req_one_option' },
      null, deps,
    )
    expect(run.view.status).toBe('ready')
    expect(run.view.options).toBeNull()
    expect(run.view.result?.clipId).toBe('clip_out')
  })

  it('fails closed for a source over 20 minutes when the isolated planner is unavailable', async () => {
    const longSource = {
      sourceId: 'proj_long',
      projectId: 'proj_long',
      title: 'Long source',
      durationMs: 21 * 60_000,
      words: [{ w: 'Long source evidence', s: 0, e: 1, spk: null }],
    }
    const deps = testDeps(new Map([['proj_long', longSource]]))
    const run = await createYoutubeVideoRun(
      'ws_long_guard', null,
      { sources: [{ kind: 'upload', projectId: 'proj_long' }], clientRequestId: 'req_long_guard' },
      null, deps,
    )
    expect(run.view.status).toBe('failed')
    expect(run.view.failureCode).toBe('yt_isolated_pipeline_required')
    expect(run.view.failureMessage).toMatch(/isolated full-source planner/i)
  })

  it('waits for the actual render and returns signed media URLs only once READY', async () => {
    const source = sourceFromWords('proj_render_source', podcastScript)
    const deps = testDeps(new Map([['proj_render_source', source]]))
    deps.pipeline.proposeOptions = () => [{
      id: 'opt_render',
      title: 'Render pending',
      premise: 'Real video output',
      beats: [{ label: 'Story', sourceId: 'proj_render_source', startMs: 0, endMs: 6000 }],
    }]
    deps.writeClip = async () => ({
      clipId: 'clip_rendered', projectId: 'proj_output', durationMs: 6000, renderId: 'rnd_one',
    })
    deps.pipeline.writeClip = deps.writeClip
    let ready = false
    deps.resolveRender = async () => ready ? {
      status: 'ready', playbackUrl: 'https://cdn.example/play.mp4',
      downloadUrl: 'https://cdn.example/download.mp4', thumbnailUrl: 'https://cdn.example/poster.jpg',
    } : { status: 'rendering', playbackUrl: null, downloadUrl: null, thumbnailUrl: null }
    const created = await createYoutubeVideoRun(
      'ws_render', null,
      { sources: [{ kind: 'upload', projectId: 'proj_render_source' }], clientRequestId: 'req_wait_render' },
      null, deps,
    )
    expect(created.view.status).toBe('running')
    expect(created.view.stage).toBe('rendering')
    expect((await getYoutubeVideoRun('ws_render', created.view.runId, deps)).status).toBe('running')
    ready = true
    const published = await getYoutubeVideoRun('ws_render', created.view.runId, deps)
    expect(published.status).toBe('ready')
    expect(published.result?.playbackUrl).toBe('https://cdn.example/play.mp4')
    expect(published.result?.downloadUrl).toBe('https://cdn.example/download.mp4')
    expect(published.result?.thumbnailUrl).toBe('https://cdn.example/poster.jpg')
  })
})
