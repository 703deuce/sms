import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NewEditDialog } from '@/components/ai-producer-agent/new-edit-dialog'
import { createProject } from '@/lib/ai-producer-agent/tools/edit'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

describe('AI Producer conversation length and layout', () => {
  it('lets the user request a sixty-second highlight from a recording', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { runId: 'run1' } }),
    } as Response)
    try {
      render(<NewEditDialog open onOpenChange={() => {}} defaultSources={[
        { sourceId: 'recording', kind: 'clip', projectId: 'p1', clipId: 'clip1', title: 'Interview' },
      ]} />)
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'rough_cut' } })
      fireEvent.change(screen.getByRole('combobox', { name: 'Desired edited length' }), { target: { value: '60' } })
      fireEvent.click(screen.getByTestId('ai-producer-agent-submit'))
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit)?.body))
      expect(request.targetLengthS).toEqual([50, 75])
      expect(request.editMode).toBe('just_chatting_rough_cut')
      expect(request.outputType).toBe('story')
    } finally {
      fetchMock.mockRestore()
    }
  })

  it('starts a clean 16:9 source frame with no speaker-wide zoom or headline band', () => {
    const ctx = {
      sources: [{ sourceId: 'src1', rangeMs: [0, 300_000] }],
      config: { editMode: 'just_chatting_rough_cut', targetLengthS: [25, 40] },
      cache: { words: [] },
    } as unknown as ToolCtx
    const out = { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
    const result = createProject(ctx, out, {
      title: 'A short interview highlight', sources: ['src1'], aspect: '9:16',
    })
    expect(result.ok).toBe(true)
    expect(out.builder?.snapshot().aspectRatio).toBe('16:9')
    expect(out.builder?.snapshot().layout.mode).toBe('full_frame')
    expect(out.builder?.snapshot().exportTemplate).toBeUndefined()
    expect(out.builder?.snapshot().hookOverlay).toBeUndefined()
    expect(out.builder?.snapshot().keyframes).toEqual(undefined)
  })
})
