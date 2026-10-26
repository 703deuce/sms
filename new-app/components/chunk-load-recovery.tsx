'use client'

import { useEffect } from 'react'

/** Reload once when a stale Next chunk 404s after deploy (avoids unstyled editor). */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const key = 'transovo-chunk-reload'
    const onError = (event: ErrorEvent) => {
      const msg = String(event.message || '')
      const src = (event.filename || '').includes('/_next/static/chunks/')
      if (!src && !msg.includes('ChunkLoadError') && !msg.includes('Loading chunk')) return
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
      window.location.reload()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason?.message || event.reason || '')
      if (!reason.includes('ChunkLoadError') && !reason.includes('Loading chunk')) return
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
      window.location.reload()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
