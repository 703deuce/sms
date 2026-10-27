'use client'

import { useEffect, useState } from 'react'

export type RecordingConfig = {
  roomsEnabled: boolean
  soloEnabled: boolean
}

export function useRecordingConfig(): RecordingConfig {
  const [config, setConfig] = useState<RecordingConfig>({ roomsEnabled: false, soloEnabled: false })
  useEffect(() => {
    let cancelled = false
    fetch('/api/recording/config')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setConfig({
          roomsEnabled: Boolean(j.enabled),
          soloEnabled: Boolean(j.soloEnabled),
        })
      })
      .catch(() => {
        if (!cancelled) setConfig({ roomsEnabled: false, soloEnabled: false })
      })
    return () => {
      cancelled = true
    }
  }, [])
  return config
}
