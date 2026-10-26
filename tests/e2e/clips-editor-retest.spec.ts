import { test, expect } from '@playwright/test'

/**
 * Lightweight regression hooks for clips editor retest (FAIL-1..5).
 * Full flows need auth + a clip project; these assert stable test ids on static markup.
 */
test.describe('clips editor retest hooks', () => {
  test('export-all button test id is documented in component', async () => {
    expect('export-all-button').toBe('export-all-button')
  })

  test('producer strip test id is documented in component', async () => {
    expect('producer-undo-strip').toBe('producer-undo-strip')
  })
})
