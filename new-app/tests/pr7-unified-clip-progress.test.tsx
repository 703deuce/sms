// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnifiedClipProgress } from '@/components/clips/unified-clip-progress'

describe('PR7 LG11 unified results status counter', () => {
  it('uses trustworthy ready count even before total is known', () => {
    render(<UnifiedClipProgress clipsReady={3} clipsTotal={0} stage="scanning" etaSec={0} />)
    expect(screen.getByText('3 ready')).toBeTruthy()
  })
  it('reports ready of total when server counts are consistent', () => {
    render(<UnifiedClipProgress clipsReady={2} clipsTotal={4} stage="ranking" etaSec={20} />)
    expect(screen.getByText('2 of 4 ready')).toBeTruthy()
  })
  it('never labels a lagging total as fewer than already-ready results', () => {
    render(<UnifiedClipProgress clipsReady={5} clipsTotal={2} stage="finding_clips" etaSec={0} />)
    expect(screen.getByText('5 ready')).toBeTruthy()
  })
})
