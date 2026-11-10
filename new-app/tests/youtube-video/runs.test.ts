import { describe, expect, it } from 'vitest'
import { chooseYoutubeVideoOption, createYoutubeVideoRun, getYoutubeVideoRun, revertYoutubeVideoRun } from '@/lib/youtube-video/runs'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import { podcastScript, sourceFromWords, testDeps } from './helpers'

describe('youtube-video runs', () => {
  it('creates from an upload, waits for a choice, then writes one clip result', async () => {
    const source = sourceFromWords('proj_ready', podcastScript, 'Interview')
    const deps = testDeps(new Map([['proj_ready', source]]))
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
    expect(fromUrl.view.status).toBe('awaiting_choice')
    expect(fromUpload.view.status).toBe('awaiting_choice')
    expect(fromUrl.view.options?.map((option) => option.id)).toEqual(fromUpload.view.options?.map((option) => option.id))
    expect(fromUrl.view.options?.[0]?.premise).toEqual(fromUpload.view.options?.[0]?.premise)
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
    expect(advanced.status).toBe('awaiting_choice')
    expect(advanced.options?.length).toBeGreaterThan(0)
    expect((await getYoutubeVideoRun('ws_wait', created.view.runId, deps)).options).toEqual(advanced.options)
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
    expect((await getYoutubeVideoRun('ws_pending_url', created.view.runId, deps)).status).toBe('awaiting_choice')
    expect(imports).toBe(1)
  })
})
