'use client'

import { useEffect } from 'react'

/** Reload once when a stale Next chunk 404s after deploy (avoids unstyled editor). */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const key = 'transovo-chunk-reload'
    const shouldReloadForAsset = (url: string) =>
      url.includes('/_next/static/chunks/') || url.includes('/_next/static/css/')

    const reloadOnce = () => {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
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
      if (!(el instanceof HTMLLinkElement)) return
      if (el.rel !== 'stylesheet') return
      const href = el.href || el.getAttribute('href') || ''
      if (!shouldReloadForAsset(href)) return
      reloadOnce()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason?.message || event.reason || '')
      if (!reason.includes('ChunkLoadError') && !reason.includes('Loading chunk')) return
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
      window.location.reload()
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
