import { describe, expect, it } from 'vitest'
import { clipProjectListSelect } from '@/lib/server/clips/projects'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'

describe('Q6-fix3 clip project list perf', () => {
  it('list select excludes transcriptWords blob', () => {
    expect('transcriptWords' in clipProjectListSelect).toBe(false)
    expect(clipProjectListSelect.id).toBe(true)
    expect(clipProjectListSelect.transcriptKey).toBe(true)
  })

  it('ClipProjectListItem shape has no transcriptWords field', () => {
    const item = {
      id: 'proj_x',
      workspaceId: 'ws',
      title: 't',
      uploadId: null,
      sourceUrl: null,
      rangeStartMs: 0,
      rangeEndMs: 60_000,
      status: 'READY' as const,
      stage: null,
      progress: 100,
      error: null,
      transcriptKey: 'ws/ws/projects/proj_x/words.json',
      thumbKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: 'dev',
      folderId: null,
      deletedAt: null,
      sourceKind: 'upload',
      lastViewedAt: null,
      clipCount: 3,
      durationMs: 60_000,
      thumbUrl: null,
    } satisfies ClipProjectListItem
    expect('transcriptWords' in item).toBe(false)
    expect(item.transcriptKey).toContain('words.json')
  })
})
