// @vitest-environment happy-dom
// @ts-expect-error root tsc does not resolve the new-app vitest install
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error root tsc does not resolve the new-app testing-library install
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  CAPTIONS_RUN_CREDITS,
  captionsCreditCount,
  captionsEditorHref,
  captionsProgressLabel,
  captionsRedirectFromRun,
  createCaptionsSource,
  isCaptionsRunInProgress,
} from '../lib/clips/ai-captions-contract'
import { AiCaptionsWorkspace } from '../components/captions/ai-captions-workspace'

const push = vi.fn()
const createAiCaptionsRun = vi.fn()
const getAiCaptionsRun = vi.fn()
const listAiCaptionsRuns = vi.fn()
const listAiCaptionsStyles = vi.fn()
const applyAiCaptionsStyle = vi.fn()
const startAiCaptionsExport = vi.fn()
const uploadClipFile = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('../lib/clips/ai-captions-api', () => ({
  createAiCaptionsRun: (...args: unknown[]) => createAiCaptionsRun(...args),
  getAiCaptionsRun: (...args: unknown[]) => getAiCaptionsRun(...args),
  listAiCaptionsRuns: (...args: unknown[]) => listAiCaptionsRuns(...args),
  aiCaptionsVttUrl: (id: string) => `/api/ai-captions/runs/${id}/vtt`,
  listAiCaptionsStyles: (...args: unknown[]) => listAiCaptionsStyles(...args),
  applyAiCaptionsStyle: (...args: unknown[]) => applyAiCaptionsStyle(...args),
  startAiCaptionsExport: (...args: unknown[]) => startAiCaptionsExport(...args),
  aiCaptionsSrtUrl: (runId: string) => `/api/ai-captions/runs/${runId}/srt`,
}))

vi.mock('../lib/clips/upload', () => ({
  uploadClipFile: (...args: unknown[]) => uploadClipFile(...args),
  fetchUploadLimits: vi.fn(async () => ({})),
  rejectFileIfOverUploadLimit: vi.fn(async () => null),
  cancelClipUpload: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const readyResult = {
  clipId: 'clip_1',
  projectId: 'proj_1',
  editorUrl: '/app/video-editor/proj_1/edit/clip_1?tab=captions',
  durationMs: 1000,
  styleId: 'clean_white',
  captionsEnabled: true as const,
  bounds: { startMs: 0 as const, endMs: 1000 },
  words: [],
  lines: [],
  playbackUrl: 'https://example.com/preview.mp4',
  thumbnailUrl: null,
  downloadUrl: 'https://example.com/captions.mp4',
  srtUrl: '/api/ai-captions/runs/run_1/srt',
}

describe('AI Captions contract helpers', () => {
  it('createCaptionsSource covers upload, project, and asset sources', () => {
    expect(createCaptionsSource({ uploadId: 'upl_1' })).toEqual({ kind: 'upload', uploadId: 'upl_1' })
    expect(createCaptionsSource({ projectId: 'proj_1' })).toEqual({ kind: 'project', projectId: 'proj_1' })
    expect(createCaptionsSource({ projectId: 'proj_1', assetId: 'asset_1' })).toEqual({
      kind: 'asset',
      projectId: 'proj_1',
      assetId: 'asset_1',
    })
  })

  it('always builds the compact clip-editor captions URL from projectId and clipId', () => {
    expect(captionsEditorHref('proj_1', 'clip_1')).toBe('/app/video-editor/proj_1/edit/clip_1?tab=captions')
    expect(
      captionsRedirectFromRun({
        status: 'ready',
        projectId: 'proj_1',
        result: readyResult,
      }),
    ).toBe('/app/video-editor/proj_1/edit/clip_1?tab=captions')
    expect(captionsRedirectFromRun({ status: 'preparing', projectId: null, result: null })).toBeNull()
  })

  it('treats preparing as in progress and uses CAPTIONS_RUN_CREDITS as the placeholder', () => {
    expect(isCaptionsRunInProgress('preparing')).toBe(true)
    expect(captionsProgressLabel('preparing', 'prepare')).toMatch(/preparing/i)
    expect(CAPTIONS_RUN_CREDITS).toBe(10)
    expect(captionsCreditCount(null)).toBe(10)
    expect(captionsCreditCount(10)).toBe(10)
  })
})

describe('AI Captions workspace', () => {
  beforeEach(() => {
    push.mockReset()
    createAiCaptionsRun.mockReset()
    getAiCaptionsRun.mockReset()
    listAiCaptionsRuns.mockReset()
    listAiCaptionsRuns.mockResolvedValue([])
    listAiCaptionsStyles.mockReset()
    applyAiCaptionsStyle.mockReset()
    startAiCaptionsExport.mockReset()
    uploadClipFile.mockReset()
    listAiCaptionsStyles.mockResolvedValue({
      defaultStyleId: 'clean_white',
      lastStyleId: null,
      styles: [{ styleId: 'clean_white', name: 'Clean White', kind: 'builtin' }],
    })
    uploadClipFile.mockImplementation(async (_file: File, onProgress: (p: { filename: string; bytes: number; loaded: number; percent: number; state: string; uploadId?: string }) => void) => {
      onProgress({ filename: 'talk.mp4', bytes: 10, loaded: 10, percent: 100, state: 'complete', uploadId: 'upl_1' })
    })
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('renders human history titles, selects by run id, and reloads history on remount', async () => {
    const historyRun = {
      runId: 'run_history',
      status: 'ready' as const,
      stage: 'ready' as const,
      progressPercent: 100,
      failureCode: null,
      failureMessage: null,
      creditEstimate: CAPTIONS_RUN_CREDITS,
      styleId: 'clean_white',
      projectId: 'proj_history',
      displayTitle: 'Customer interview',
      sourceTitle: 'Customer interview',
      createdAt: '2026-11-10T12:00:00.000Z',
      result: { ...readyResult, clipId: 'clip_history', projectId: 'proj_history' },
    }
    listAiCaptionsRuns.mockResolvedValue([historyRun])
    getAiCaptionsRun.mockResolvedValue(historyRun)

    render(<AiCaptionsWorkspace />)
    await waitFor(() => expect(screen.getByText('Customer interview')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open caption run Customer interview' }))
    await waitFor(() => expect(getAiCaptionsRun).toHaveBeenCalledWith('run_history'))
    expect(screen.queryByText('proj_history')).toBeNull()

    cleanup()
    render(<AiCaptionsWorkspace />)
    await waitFor(() => expect(listAiCaptionsRuns.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(screen.getByText('Customer interview')).toBeTruthy()
  })

  it('shows worker elapsed time and ETA during burned-in export', async () => {
    const exportingRun = {
      runId: 'run_exporting',
      status: 'exporting' as const,
      stage: 'export' as const,
      progressPercent: 90,
      failureCode: null,
      failureMessage: null,
      creditEstimate: CAPTIONS_RUN_CREDITS,
      styleId: 'clean_white',
      projectId: 'proj_exporting',
      displayTitle: 'Export test',
      result: { ...readyResult, downloadUrl: null, renderId: 'rnd_exporting' },
    }
    listAiCaptionsRuns.mockResolvedValue([exportingRun])
    getAiCaptionsRun.mockResolvedValue({
      ...exportingRun,
      stage: 'export_encode',
      progressPercent: 95,
      exportProgress: { workerStage: 'render_clip', elapsedMs: 75_000, etaSeconds: 35 },
    })

    render(<AiCaptionsWorkspace />)
    await waitFor(() => expect(screen.getByText('Export test')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open caption run Export test' }))
    await waitFor(() => expect(screen.getByTestId('ai-captions-export-timing')).toBeTruthy())
    expect(screen.getByTestId('ai-captions-export-timing').textContent).toMatch(/1m 15s elapsed/)
    expect(screen.getByTestId('ai-captions-export-timing').textContent).toMatch(/ETA about 35s/)
  })


  it('ignores an old pending poll after a different history run is selected', async () => {
    const newest = {
      runId: 'run_new',
      status: 'ready' as const,
      stage: 'ready' as const,
      progressPercent: 100,
      failureCode: null,
      failureMessage: null,
      creditEstimate: CAPTIONS_RUN_CREDITS,
      styleId: 'clean_white',
      projectId: 'proj_new',
      displayTitle: 'New selection',
      result: { ...readyResult, projectId: 'proj_new', clipId: 'clip_new',
        editorUrl: '/app/video-editor/proj_new/edit/clip_new?tab=captions' },
    }
    listAiCaptionsRuns.mockResolvedValue([newest])
    createAiCaptionsRun.mockResolvedValue({
      runId: 'run_old',
      status: 'preparing',
      creditEstimate: CAPTIONS_RUN_CREDITS,
    })
    let resolveOld!: (value: unknown) => void
    getAiCaptionsRun.mockImplementation((id: string) => {
      if (id === 'run_old') return new Promise((resolve) => { resolveOld = resolve })
      if (id === 'run_new') return Promise.resolve(newest)
      throw new Error('unexpected run')
    })

    render(<AiCaptionsWorkspace />)
    await waitFor(() => expect(screen.getByText('New selection')).toBeTruthy())
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['ok'], 'talk.mp4', { type: 'video/mp4' })] } })
    await waitFor(() => expect(getAiCaptionsRun.mock.calls.some(([id]) => id === 'run_old')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Open caption run New selection' }))
    await waitFor(() => expect(screen.getByTestId('ai-captions-result')).toBeTruthy())
    resolveOld({
      ...newest,
      runId: 'run_old',
      projectId: 'proj_old',
      displayTitle: 'Old response',
      result: { ...readyResult, projectId: 'proj_old', clipId: 'clip_old' },
    })
    await act(async () => { await Promise.resolve() })

    fireEvent.click(screen.getByTestId('ai-captions-edit'))
    expect(push).toHaveBeenLastCalledWith('/app/video-editor/proj_new/edit/clip_new?tab=captions')
  })

  it('bounds transient status reconnects and Retry status only replays GET polling', async () => {
    vi.useFakeTimers()
    const running = {
      runId: 'run_reconnect',
      status: 'transcribing' as const,
      stage: 'transcribe' as const,
      progressPercent: 30,
      failureCode: null,
      failureMessage: null,
      creditEstimate: CAPTIONS_RUN_CREDITS,
      styleId: 'clean_white',
      projectId: 'proj_reconnect',
      displayTitle: 'Reconnect test',
      result: null,
    }
    listAiCaptionsRuns.mockResolvedValue([running])
    let statusCalls = 0
    getAiCaptionsRun.mockImplementation(() => {
      statusCalls += 1
      return statusCalls === 1 ? Promise.resolve(running) : Promise.reject(new Error('network interrupted'))
    })

    render(<AiCaptionsWorkspace />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    const historyButton = screen.getByRole('button', { name: 'Open caption run Reconnect test' })
    fireEvent.click(historyButton)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(getAiCaptionsRun.mock.calls.length).toBeGreaterThanOrEqual(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(screen.getByTestId('ai-captions-retry-status')).toBeTruthy()
    const stoppedAt = getAiCaptionsRun.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(getAiCaptionsRun).toHaveBeenCalledTimes(stoppedAt)

    fireEvent.click(screen.getByTestId('ai-captions-retry-status'))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(getAiCaptionsRun.mock.calls.length).toBe(stoppedAt + 1)
    expect(createAiCaptionsRun).not.toHaveBeenCalled()
    expect(startAiCaptionsExport).not.toHaveBeenCalled()
  })

  it('uploads, starts a captions run, shows preparing, then Edit opens the Captions tab', async () => {
    createAiCaptionsRun.mockResolvedValue({
      runId: 'run_1',
      status: 'preparing',
      creditEstimate: CAPTIONS_RUN_CREDITS,
    })
    const readyRun = {
      runId: 'run_1',
      status: 'ready' as const,
      stage: 'ready' as const,
      progressPercent: 100,
      failureCode: null,
      failureMessage: null,
      creditEstimate: CAPTIONS_RUN_CREDITS,
      styleId: 'clean_white',
      projectId: 'proj_1',
      result: readyResult,
    }
    let releaseFirstPoll: ((value: unknown) => void) | null = null
    getAiCaptionsRun.mockImplementation(() => {
      if (!releaseFirstPoll) {
        return new Promise((resolve: (value: unknown) => void) => {
          releaseFirstPoll = resolve
        })
      }
      return Promise.resolve(readyRun)
    })

    render(<AiCaptionsWorkspace />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['ok'], 'talk.mp4', { type: 'video/mp4' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(createAiCaptionsRun).toHaveBeenCalled())
    expect(createAiCaptionsRun.mock.calls[0][0].source).toEqual({ kind: 'upload', uploadId: 'upl_1' })
    expect(createAiCaptionsRun.mock.calls[0][0].styleId).toBe('clean_white')
    await waitFor(() => expect(screen.getByTestId('ai-captions-progress').getAttribute('data-status')).toBe('preparing'))
    if (!releaseFirstPoll) throw new Error('expected the run poll to start')
    releaseFirstPoll(readyRun)
    await waitFor(() => expect(screen.getByTestId('ai-captions-result')).toBeTruthy())
    expect(screen.getByTestId('ai-captions-credits').textContent).toMatch(/10 credits/)
    expect(screen.getByTestId('ai-captions-credits').textContent).not.toMatch(/\$/)
    expect(screen.getByTestId('ai-captions-vtt')).toBeTruthy()
    expect(screen.getByTestId('ai-captions-run-list')).toBeTruthy()
    fireEvent.click(screen.getByTestId('ai-captions-edit'))
    expect(push).toHaveBeenCalledWith('/app/video-editor/proj_1/edit/clip_1?tab=captions')
  })
})
