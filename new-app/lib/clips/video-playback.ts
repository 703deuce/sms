/** Browser-safe video play with sound (autoplay policy). */

export async function playWithSound(video: HTMLVideoElement): Promise<'playing' | 'muted'> {
  video.muted = false
  if (video.volume <= 0) video.volume = 1
  try {
    await video.play()
    return 'playing'
  } catch {
    video.muted = true
    try {
      await video.play()
      return 'muted'
    } catch {
      return 'muted'
    }
  }
}

export function pauseVideo(video: HTMLVideoElement) {
  video.pause()
}
