import { beforeEach, describe, expect, it, vi } from 'vitest'

const ai = vi.hoisted(() => vi.fn())
const audio = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/ai/script-editor-openai', () => ({ scriptEditorOpenAiJson: ai }))
vi.mock('@/lib/server/clips/composition-audio', () => ({ getCompositionAudioContext: audio }))
vi.mock('@/lib/server/workspace', () => ({ resolveWorkspaceId: async () => 'fixture_workspace' }))
vi.mock('@/lib/server/clips/script-editor-log', () => ({ logEditor: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  audio.mockResolvedValue({
    lengthMs: 300000, chapterDurationMs: 600000,
    keptWords: [{ text: 'Start' }, { text: 'Ending' }],
    timedKeptWords: [{ text: 'Start', outMs: 0 }, { text: 'After cut', outMs: 350000 }, { text: 'Ending', outMs: 480000 }],
  })
})

describe('HG10 chapters route output timeline contract', () => {
  it('provides edited clock anchors to the mocked generator, preserving late chapter offsets', async () => {
    ai.mockResolvedValue({ chapters: [
      { outMs: 0, label: 'Introduction' },
      { outMs: 350000, label: 'After cut' },
      { outMs: 480000, label: 'Conclusion' },
    ] })
    const { POST } = await import('@/app/api/clips/compositions/[compositionId]/chapters/route')
    const res = await POST(new Request('https://example.invalid/chapters', { method: 'POST' }), {
      params: Promise.resolve({ compositionId: 'fixture_composition' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.chapters.map((c: { outMs: number }) => c.outMs)).toEqual([0,350000,480000])
    const prompt = ai.mock.calls[0]?.[1] as string
    expect(prompt).toContain('[350.00s] After cut')
    expect(prompt).toContain('[480.00s] Ending')
    expect(JSON.parse(prompt).durationMs).toBe(600000)
  })
  it('clamps out-of-range timestamps but does not rewrite labels or collapse the end to zero', async () => {
    ai.mockResolvedValue({ chapters: [
      { outMs: 45000, label: 'First part' },
      { outMs: 999999, label: 'Last part' },
    ] })
    const { POST } = await import('@/app/api/clips/compositions/[compositionId]/chapters/route')
    const res = await POST(new Request('https://example.invalid/chapters', { method: 'POST' }), {
      params: Promise.resolve({ compositionId: 'fixture_composition' }),
    })
    const { data } = await res.json()
    expect(data.chapters).toEqual([
      { outMs: 45000, label: 'First part' },
      { outMs: 600000, label: 'Last part' },
    ])
  })
})
