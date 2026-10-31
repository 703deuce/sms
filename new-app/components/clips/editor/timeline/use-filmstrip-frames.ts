'use client'

import { useEffect, useState } from 'react'

/**
 * FV2 client-side filmstrip frames (clips + B-roll, and zoomed-in refinement on full videos).
 * One hidden <video crossOrigin="anonymous"> per media URL seeks to the requested times and draws
 * small JPEG thumbs into memory — nothing is uploaded or stored (no B2 files). If the media can't be
 * read into a canvas (no CORS), the extractor marks itself failed and callers fall back.
 */

const THUMB_H = 72
const MAX_FRAMES = 600
const SEEK_TIMEOUT_MS = 4000

type Listener = () => void

export class FrameExtractor {
  readonly url: string
  failed = false
  aspect: number | null = null
  private video: HTMLVideoElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private cache = new Map<string, string>()
  private wanted: string[] = []
  private wantedSet = new Set<string>()
  private running = false
  private listeners = new Set<Listener>()
  private notifyTimer: ReturnType<typeof setTimeout> | null = null
  private ready: Promise<boolean> | null = null
  refs = 0

  constructor(url: string) {
    this.url = url
  }

  static key(ms: number, quantumMs: number): string {
    return `${quantumMs}:${Math.round(ms / quantumMs) * quantumMs}`
  }

  /** Best decoded frame for `ms`: exact quantum first, then any coarser cached quantum. */
  get(ms: number, quantumMs: number): string | null {
    const exact = this.cache.get(FrameExtractor.key(ms, quantumMs))
    if (exact) return exact
    for (const q of [250, 500, 1000, 2000, 5000, 10000, 30000, 60000]) {
      if (q === quantumMs) continue
      const v = this.cache.get(FrameExtractor.key(ms, q))
      if (v) return v
    }
    return null
  }

  /** Ask for these times (newest request wins priority; stale ones are dropped). */
  want(times: number[], quantumMs: number): void {
    if (this.failed || typeof document === 'undefined') return
    const next: string[] = []
    for (const t of times) {
      const k = FrameExtractor.key(t, quantumMs)
      if (!this.cache.has(k)) next.push(k)
    }
    this.wanted = next
    this.wantedSet = new Set(next)
    if (next.length) void this.pump()
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  dispose(): void {
    this.wanted = []
    this.listeners.clear()
    if (this.video) {
      this.video.removeAttribute('src')
      this.video.load()
    }
    this.video = null
    this.canvas = null
  }

  private notify() {
    if (this.notifyTimer) return
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null
      this.listeners.forEach((l) => l())
    }, 120)
  }

  private init(): Promise<boolean> {
    if (this.ready) return this.ready
    this.ready = new Promise<boolean>((resolve) => {
      const v = document.createElement('video')
      v.crossOrigin = 'anonymous'
      v.muted = true
      v.preload = 'auto'
      v.playsInline = true
      const done = (ok: boolean) => {
        v.onloadedmetadata = null
        v.onerror = null
        if (!ok) this.failed = true
        resolve(ok)
      }
      v.onloadedmetadata = () => {
        this.aspect = v.videoWidth > 0 && v.videoHeight > 0 ? v.videoWidth / v.videoHeight : null
        done(true)
      }
      v.onerror = () => done(false)
      v.src = this.url
      this.video = v
      this.canvas = document.createElement('canvas')
    })
    return this.ready
  }

  private seek(sec: number): Promise<boolean> {
    const v = this.video
    if (!v) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const t = setTimeout(() => {
        v.onseeked = null
        resolve(false)
      }, SEEK_TIMEOUT_MS)
      v.onseeked = () => {
        clearTimeout(t)
        v.onseeked = null
        resolve(true)
      }
      v.currentTime = Math.max(0, Math.min(sec, Number.isFinite(v.duration) ? Math.max(0, v.duration - 0.05) : sec))
    })
  }

  private async pump() {
    if (this.running) return
    this.running = true
    try {
      if (!(await this.init())) return
      while (this.wanted.length && !this.failed && this.video && this.canvas) {
        const k = this.wanted.shift()!
        if (!this.wantedSet.has(k) || this.cache.has(k)) continue
        const ms = Number(k.split(':')[1])
        if (!(await this.seek(ms / 1000))) continue
        const v = this.video
        const c = this.canvas
        if (!v || !c) break
        const aspect = v.videoWidth > 0 && v.videoHeight > 0 ? v.videoWidth / v.videoHeight : 16 / 9
        c.height = THUMB_H
        c.width = Math.max(8, Math.round(THUMB_H * aspect))
        try {
          const ctx = c.getContext('2d')
          if (!ctx) {
            this.failed = true
            break
          }
          ctx.drawImage(v, 0, 0, c.width, c.height)
          const data = c.toDataURL('image/jpeg', 0.6)
          this.cache.set(k, data)
          if (this.cache.size > MAX_FRAMES) {
            const first = this.cache.keys().next().value
            if (first !== undefined) this.cache.delete(first)
          }
          this.notify()
        } catch {
          // Tainted canvas (media served without CORS) — stop; callers fall back to sprite / poster.
          this.failed = true
          this.notify()
          break
        }
      }
    } finally {
      this.running = false
    }
  }
}

const extractors = new Map<string, FrameExtractor>()

/** Extractor for a URL (shared across lane items), or null when disabled. Re-renders on new frames. */
export function useFilmstripFrames(url: string | null | undefined): FrameExtractor | null {
  const [, setTick] = useState(0)
  const [ex, setEx] = useState<FrameExtractor | null>(null)
  useEffect(() => {
    if (!url || typeof document === 'undefined') {
      setEx(null)
      return
    }
    let e = extractors.get(url)
    if (!e) {
      e = new FrameExtractor(url)
      extractors.set(url, e)
    }
    e.refs++
    setEx(e)
    const off = e.subscribe(() => setTick((n) => n + 1))
    const cur = e
    return () => {
      off()
      cur.refs--
      if (cur.refs <= 0) {
        cur.dispose()
        extractors.delete(url)
      }
    }
  }, [url])
  return ex
}
