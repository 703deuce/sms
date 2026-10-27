'use client'

import { useEffect, useState } from 'react'

export function useRecordingEnabled() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/recording/config')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setEnabled(Boolean(j.enabled))
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return enabled
}
