// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ProjectCard } from '@/components/clips/project-card'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'

vi.mock('@/components/clips/project-card-queue', () => ({ ProjectCardQueueHint: () => null }))
afterEach(() => cleanup())

function project(status: 'FAILED' | 'DRAFT' | 'READY', title: string): ClipProjectListItem {
  return {
    id: title, title, status, clipCount: 0, thumbUrl: null, durationMs: 0,
    sourceKind: 'upload', error: status === 'FAILED' ? 'Processing was interrupted' : null,
    createdAt: new Date('2026-11-10').toISOString(),
  } as unknown as ClipProjectListItem
}

describe('LG10 saved-work status visibility', () => {
  it('keeps failed, empty draft and ready project cards accessible without deleting saved work', () => {
    render(<>
      <ProjectCard project={project('FAILED', 'Failed draft')} />
      <ProjectCard project={project('DRAFT', 'Empty draft')} />
      <ProjectCard project={project('READY', 'Ready project')} />
    </>)
    expect(screen.getAllByTestId('project-card')).toHaveLength(3)
    expect(screen.getByText('Failed draft')).toBeTruthy()
    expect(screen.getByText('Empty draft')).toBeTruthy()
    expect(screen.getByText('Ready project')).toBeTruthy()
    expect(screen.getByText('Add media to start')).toBeTruthy()
  })
})
