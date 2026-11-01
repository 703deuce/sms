/**
 * G4cfix: fast browser scene scan shared by the Video lane, B-roll and inserted clips.
 * Coarse pass: ≤ SCENE_FAST_MAX tiny frames (SCENE_SCAN_W px) read by two hidden CORS <video>s in
 * parallel over the requested ranges only; each candidate is then bisected to one frame.
 * (G4c sampled every 200 ms at 96 px with one reader: ~1 % / 8 s on a 12-min clip.)
 */
import {
  detectCuts,
  frameSig,
  refineCut,
  sampleTimes,
  SCENE_FAST_MAX,
  SCENE_FAST_STEP_MS,
  SCENE_SCAN_W,
  type SceneSample,
  type SceneSig,
} from '@/lib/clips/editor/scene-detect'
import { openScanner, type Scanner } from './frame-scan'

export type SceneCand = { t: number; score: number }

export async function scanSceneCuts(opts: {
  url: string
  /** Ranges in the caller's ms (source ms for the main video, media ms for B-roll / inserts). */
  ranges: [number, number][]
  /** Caller ms → seconds in the media file. */
  toVideoSec: (ms: number) => number
  onProgress?: (pct: number) => void
  stopped?: () => boolean
  readers?: number
}): Promise<{ cuts: SceneCand[] } | { error: string } | { stopped: true }> {
  const times = sampleTimes(opts.ranges, SCENE_FAST_STEP_MS, SCENE_FAST_MAX)
  if (!times.length) return { cuts: [] }
  const n = Math.max(1, Math.min(opts.readers ?? 2, 4))
  const scanners: Scanner[] = []
  for (let i = 0; i < n; i++) {
    const sc = await openScanner(opts.url, SCENE_SCAN_W)
    if ('error' in sc) {
      if (!scanners.length) return { error: sc.error }
      break
    }
    scanners.push(sc)
  }
  const sigWith = async (sc: Scanner, t: number): Promise<SceneSig | null> => {
    const f = await sc.frameAt(opts.toVideoSec(t))
    return f ? frameSig(f.px, f.w, f.h) : null
  }
  try {
    const sigs: (SceneSig | null)[] = new Array(times.length).fill(null)
    let done = 0
    // Each reader takes a contiguous chunk (sequential seeks inside a chunk stay cheap).
    const chunk = Math.ceil(times.length / scanners.length)
    await Promise.all(
      scanners.map(async (sc, k) => {
        for (let i = k * chunk; i < Math.min(times.length, (k + 1) * chunk); i++) {
          if (opts.stopped?.()) return
          sigs[i] = await sigWith(sc, times[i]!)
          done++
          if (done % 8 === 0) opts.onProgress?.(Math.round((done / times.length) * 90))
        }
      }),
    )
    if (opts.stopped?.()) return { stopped: true }
    const samples: SceneSample[] = []
    times.forEach((t, i) => {
      const sig = sigs[i]
      if (sig) samples.push({ t, sig })
    })
    const raw = detectCuts(samples)
    const out: SceneCand[] = []
    for (const c of raw) {
      if (opts.stopped?.()) return { stopped: true }
      const i = samples.findIndex((s) => s.t === c.t)
      const prev = samples[i - 1]
      const sameRange = prev && opts.ranges.some(([a, b]) => prev.t >= a && c.t < b)
      const t = sameRange && prev ? await refineCut(prev.t, c.t, prev.sig, samples[i]!.sig, (x) => sigWith(scanners[0]!, x)) : c.t
      out.push({ t, score: c.score })
    }
    opts.onProgress?.(100)
    return { cuts: out }
  } finally {
    for (const sc of scanners) sc.close()
  }
}
