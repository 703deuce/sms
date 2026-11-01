'use client'

import {
  CHUNK_RELOAD_COOLDOWN_MS,
  shouldReloadForChunkError,
  shouldReloadForChunkFailure,
} from '@/lib/clips/editor/editor-reload-paths'
import { useEffect } from 'react'

const RELOAD_KEY = 'transovo-chunk-reload'

export { CHUNK_RELOAD_COOLDOWN_MS, shouldReloadForChunkError }

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
      if (!shouldReloadForChunkFailure(event.filename || '', msg)) return
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
