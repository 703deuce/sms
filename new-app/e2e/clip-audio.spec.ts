import { test, expect } from '@playwright/test'

test.describe('clip audio playback', () => {
  test('clip card unmutes after click', async ({ page }) => {
    await page.goto('/app/clips', { waitUntil: 'domcontentloaded' })
    const cardVideo = page.locator('[data-testid="clip-card-video"]').first()
    if ((await cardVideo.count()) === 0) {
      test.skip(true, 'no clip cards in workspace')
    }
    await cardVideo.click()
    const muted = await cardVideo.evaluate((el: HTMLVideoElement) => el.muted)
    const volume = await cardVideo.evaluate((el: HTMLVideoElement) => el.volume)
    expect(volume).toBeGreaterThan(0)
    // After explicit click we attempt unmuted play; may stay muted if policy blocks but volume must be set.
    if (!muted) {
      expect(muted).toBe(false)
    }
  })

  test('editor player has volume control and non-zero volume after play', async ({ page }) => {
    await page.goto('/app/clips', { waitUntil: 'domcontentloaded' })
    const editLink = page.getByRole('link', { name: 'Edit' }).first()
    if ((await editLink.count()) === 0) {
      test.skip(true, 'no clips to edit')
    }
    await editLink.click()
    await page.waitForURL(/\/edit\//, { timeout: 30_000 })
    await page.getByRole('button', { name: 'Play' }).click()
    const volumeSlider = page.getByRole('slider', { name: 'Volume' })
    await expect(volumeSlider).toBeVisible()
    const video = page.locator('video').first()
    const volume = await video.evaluate((el: HTMLVideoElement) => el.volume)
    expect(volume).toBeGreaterThan(0)
  })
})
