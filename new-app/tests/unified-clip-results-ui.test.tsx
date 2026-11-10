// @vitest-environment happy-dom
// @ts-expect-error root tsc does not resolve the new-app vitest install
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MOCK_UNIFIED_CLIPS } from '../lib/clips/unified-clip-results'
import { UnifiedClipResults } from '../components/clips/unified-clip-results'
import { UnifiedClipRunNote } from '../components/clips/unified-clip-run-note'
import { UnifiedClipTypeBadge } from '../components/clips/unified-clip-type-badge'
import { UnifiedClipProgress } from '../components/clips/unified-clip-progress'
import { useState } from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

function Harness() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'story' | 'continuous'>('all')
  const [sort, setSort] = useState<'score' | 'type' | 'duration' | 'timeline' | 'title'>('score')
  return (
    <UnifiedClipResults
      clips={MOCK_UNIFIED_CLIPS}
      projectId="proj_demo"
      typeFilter={typeFilter}
      sort={sort}
      onTypeFilterChange={setTypeFilter}
      onSortChange={setSort}
      status="ready"
    />
  )
}

describe('unified clip results UI', () => {
  afterEach(() => cleanup())
  it('renders score, title, duration, and Story/Continuous badges on the grid', () => {
    render(<Harness />)
    expect(screen.getByText('The hook that sold the room')).toBeTruthy()
    expect(screen.getByText('Unbroken laugh from the couch')).toBeTruthy()
    expect(screen.getAllByTestId('unified-clip-type-badge').length).toBe(4)
    expect(screen.getAllByTestId('unified-clip-type-badge').map((el) => el.getAttribute('data-kind')).sort()).toEqual(
      ['continuous', 'continuous', 'story', 'story'],
    )
    expect(screen.getByText(/48s clip|0:48 clip|48\.2/)).toBeTruthy()
  })

  it('filters to Continuous clips from the toolbar', () => {
    render(<Harness />)
    fireEvent.click(screen.getByTestId('unified-filter-continuous'))
    expect(screen.getByText('Unbroken laugh from the couch')).toBeTruthy()
    expect(screen.queryByText('The hook that sold the room')).toBeNull()
    expect(screen.getAllByTestId('unified-clip-type-badge').every((el) => el.getAttribute('data-kind') === 'continuous')).toBe(true)
  })

  it('shows designed progress, empty, and error states', () => {
    const { rerender } = render(
      <UnifiedClipResults
        clips={[]}
        projectId="proj_demo"
        typeFilter="all"
        sort="score"
        onTypeFilterChange={() => {}}
        onSortChange={() => {}}
        status="loading"
        etaSec={90}
      />,
    )
    expect(screen.getByTestId('unified-clip-progress')).toBeTruthy()
    expect(screen.getByText(/ETA/)).toBeTruthy()

    rerender(
      <UnifiedClipResults
        clips={[]}
        projectId="proj_demo"
        typeFilter="all"
        sort="score"
        onTypeFilterChange={() => {}}
        onSortChange={() => {}}
        status="empty"
      />,
    )
    expect(screen.getByText('No clips found')).toBeTruthy()

    rerender(
      <UnifiedClipResults
        clips={[]}
        projectId="proj_demo"
        typeFilter="all"
        sort="score"
        onTypeFilterChange={() => {}}
        onSortChange={() => {}}
        status="error"
        error="Worker timed out."
        onRetry={() => {}}
      />,
    )
    expect(screen.getByText("Couldn't finish this clip run")).toBeTruthy()
    expect(screen.getByText('Worker timed out.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry processing' })).toBeTruthy()
  })

  it('renders the run note without a Story/Continuous mode picker', () => {
    render(
      <UnifiedClipRunNote>
        <select aria-label="Agent target length">
          <option>60 seconds</option>
        </select>
      </UnifiedClipRunNote>,
    )
    expect(screen.getByTestId('unified-clip-run-note').textContent).toMatch(/Story/)
    expect(screen.queryByLabelText(/AI clipping mode/i)).toBeNull()
    expect(screen.queryByLabelText(/Agent clip mode/i)).toBeNull()
    expect(screen.getByLabelText('Agent target length')).toBeTruthy()
  })

  it('labels Story and Continuous badges', () => {
    const { rerender } = render(<UnifiedClipTypeBadge kind="story" />)
    expect(screen.getByTestId('unified-clip-type-badge').textContent).toBe('Story')
    rerender(<UnifiedClipTypeBadge kind="continuous" />)
    expect(screen.getByTestId('unified-clip-type-badge').textContent).toBe('Continuous')
  })

  it('exposes a progress status region', () => {
    render(<UnifiedClipProgress clipsReady={1} clipsTotal={4} etaSec={45} />)
    expect(screen.getByTestId('unified-clip-progress').getAttribute('role')).toBe('status')
    expect(screen.getByText('1 of 4 ready')).toBeTruthy()
  })
})
