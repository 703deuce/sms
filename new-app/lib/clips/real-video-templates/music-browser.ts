/**
 * Browser-only Batch 5 analyzer. Analyze a user's actual music file once,
 * pin SHA-256/beat frames, then store the schedule with template authoring.
 * Never redetect when opening an existing template instance.
 */
import { detectBeats, monoSamples } from '@/lib/clips/editor/beats'
import { filterBeatsForCut } from '@/lib/clips/editor/strong-beats'
import { pinMusicSchedule, type AudioLicenseRecord, type AuthoredMusicScheduleV1 } from './music-timing'

export async function analyzeTemplateMusicFile(input: {
  file: File
  registeredUploadId: string
  author: string
  userConfirmedRights: boolean
  timing: 'fixed-time' | 'beat-time'
  offsetFrames?: number
}): Promise<{ schedule: AuthoredMusicScheduleV1; rights: AudioLicenseRecord }> {
  if (!input.userConfirmedRights)
    throw new Error('Confirm you own or have commercial export rights to this audio')
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(input.registeredUploadId))
    throw new Error('Music must be uploaded to your project media library first')
  if (!input.author.trim()) throw new Error('Enter an author or rights holder')
  if (!input.file.type.startsWith('audio/') || input.file.size < 128 || input.file.size > 100 * 1024 * 1024)
    throw new Error('Choose an actual audio file up to 100 MB')
  if (typeof window === 'undefined' || !window.crypto?.subtle)
    throw new Error('Local music verification requires a secure browser connection')
  const fileBytes = await input.file.arrayBuffer()
  const digest = await window.crypto.subtle.digest('SHA-256', fileBytes)
  const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('')
  const Context = window.AudioContext
  if (!Context) throw new Error('Audio decoding is not supported by this browser')
  const context = new Context()
  try {
    const decoded = await context.decodeAudioData(fileBytes.slice(0))
    if (!Number.isFinite(decoded.duration) || decoded.duration < 1 || decoded.duration > 1800)
      throw new Error('Music duration must be between 1 second and 30 minutes')
    const durationFrames = Math.round(decoded.duration * 30)
    const rights: AudioLicenseRecord = {
      assetId: input.registeredUploadId,
      origin: 'user-upload',
      author: input.author.trim(),
      license: 'user-owned',
      revision: 'ack:' + new Date().toISOString(),
      sha256, commercialUse: true, exportAllowed: true,
      redistributionAllowed: false,
      verifiedDurationFrames: durationFrames,
      verifiedAt: new Date().toISOString(),
    }
    const grid = detectBeats(monoSamples(decoded), decoded.sampleRate)
    return {
      rights,
      schedule: pinMusicSchedule({
        assetId: input.registeredUploadId,
        license: rights,
        grid: {
          bpm: grid.bpm,
          beatsMs: filterBeatsForCut(grid.beatsMs, 'all'),
        },
        mode: input.timing,
        offsetFrames: input.offsetFrames,
      }),
    }
  } finally {
    await context.close()
  }
}
