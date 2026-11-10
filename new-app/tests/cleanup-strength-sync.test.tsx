// @vitest-environment happy-dom
// @ts-expect-error root tsc does not resolve the new-app vitest install
import { afterEach, describe, expect, it } from 'vitest'
import { createElement, useState } from 'react'
// @ts-expect-error root tsc does not resolve the new-app testing-library install
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

afterEach(cleanup)
import { useSyncedCleanupPanelStrength } from '../lib/clips/editor/cleanup-strength-sync'
import type { CleanupStrength } from '../lib/clips/editor/cleanup-strength'

function StrengthHarness({ defaultStrength }: { defaultStrength?: CleanupStrength }) {
  const { strength, setStrength } = useSyncedCleanupPanelStrength(defaultStrength)
  return createElement(
    'div',
    null,
    createElement('span', { 'data-testid': 'strength' }, strength),
    (['light', 'normal', 'aggressive'] as const).map((level) =>
      createElement(
        'button',
        {
          key: level,
          type: 'button',
          'data-testid': `cleanup-strength-${level}`,
          onClick: () => setStrength(level),
        },
        level,
      ),
    ),
  )
}

function LateMetaHarness({ start, later }: { start?: CleanupStrength; later: CleanupStrength }) {
  const [defaultStrength, setDefaultStrength] = useState<CleanupStrength | undefined>(start)
  return createElement(
    'div',
    null,
    createElement(StrengthHarness, { defaultStrength }),
    createElement(
      'button',
      { type: 'button', 'data-testid': 'arrive-aimeta', onClick: () => setDefaultStrength(later) },
      'arrive',
    ),
  )
}

describe('CleanupPanel defaultStrength re-sync', () => {
  it('re-syncs to light when aiMeta arrives after mount and the user has not picked a strength', () => {
    render(createElement(LateMetaHarness, { later: 'light' }))
    expect(screen.getByTestId('strength').textContent).toBe('normal')
    fireEvent.click(screen.getByTestId('arrive-aimeta'))
    expect(screen.getByTestId('strength').textContent).toBe('light')
  })

  it('keeps the user-picked strength when aiMeta arrives late', () => {
    render(createElement(LateMetaHarness, { later: 'light' }))
    expect(screen.getByTestId('strength').textContent).toBe('normal')
    fireEvent.click(screen.getByTestId('cleanup-strength-aggressive'))
    expect(screen.getByTestId('strength').textContent).toBe('aggressive')
    fireEvent.click(screen.getByTestId('arrive-aimeta'))
    expect(screen.getByTestId('strength').textContent).toBe('aggressive')
  })
})
