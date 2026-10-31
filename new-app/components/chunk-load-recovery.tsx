'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'transovo-chunk-reload'
/** Do not reload again within this window (prevents a reload loop on a real outage). */
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000

/**
 * E2fix: the guard used to be a bare '1' that was never cleared, so a tab (or a duplicated tab,
 * which copies sessionStorage) that had recovered once could never recover from a later stale
 * chunk — it stayed on the half-hydrated page. Store a timestamp and allow one reload per
 * cooldown window instead. Also recover on a 404'd /_next/static/chunks <script> (resource errors
 * only reach the capture listener).
 */
export function shouldReloadForChunkError(stored: string | null, nowMs: number): boolean {
  if (!stored) return true
  const at = Number(stored)
  // Legacy '1' (or garbage) carries no time: allow one reload, the new stamp guards the loop.
  if (!Number.isFinite(at) || at < 1e12) return true
  return nowMs - at > CHUNK_RELOAD_COOLDOWN_MS
}

/** Reload once when a stale Next chunk 404s after deploy (avoids unstyled editor). */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const shouldReloadForAsset = (url: string) =>
      url.includes('/_next/static/chunks/') || url.includes('/_next/static/css/')

    const reloadOnce = () => {
      let stored: string | null = null
      try {
        stored = sessionStorage.getItem(RELOAD_KEY)
      } catch {
        /* storage blocked: still recover once */
      }
      const now = Date.now()
      if (!shouldReloadForChunkError(stored, now)) return
      try {
        sessionStorage.setItem(RELOAD_KEY, String(now))
      } catch {
        /* ignore */
      }
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => {
      const msg = String(event.message || '')
      const src = shouldReloadForAsset(event.filename || '')
      if (!src && !msg.includes('ChunkLoadError') && !msg.includes('Loading chunk')) return
      reloadOnce()
    }

    const onResourceError = (event: Event) => {
      const el = event.target
      if (el instanceof HTMLScriptElement) {
        // A stale JS chunk 404 surfaces here (resource errors do not bubble to onError).
        if (shouldReloadForAsset(el.src || '')) reloadOnce()
        return
      }
      if (!(el instanceof HTMLLinkElement)) return
      if (el.rel !== 'stylesheet') return
      const href = el.href || el.getAttribute('href') || ''
      if (!shouldReloadForAsset(href)) return
      reloadOnce()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason?.message || event.reason || '')
      if (!reason.includes('ChunkLoadError') && !reason.includes('Loading chunk')) return
      reloadOnce()
    }
    window.addEventListener('error', onError)
    window.addEventListener('error', onResourceError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('error', onResourceError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
