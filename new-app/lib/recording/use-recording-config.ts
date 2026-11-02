'use client'

import { useEffect, useState } from 'react'

export type RecordingConfig = {
  roomsEnabled: boolean
  soloEnabled: boolean
}

const DEFAULT_CONFIG: RecordingConfig = { roomsEnabled: false, soloEnabled: false }

let cachedConfig: RecordingConfig | null = null
let inflight: Promise<RecordingConfig> | null = null

function fetchRecordingConfigOnce(): Promise<RecordingConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig)
  if (inflight) return inflight
  inflight = fetch('/api/recording/config')
    .then((r) => r.json())
    .then((j) => {
      cachedConfig = {
        roomsEnabled: Boolean(j.enabled),
        soloEnabled: Boolean(j.soloEnabled),
      }
      return cachedConfig
    })
    .catch(() => {
      cachedConfig = DEFAULT_CONFIG
      return cachedConfig
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Test hook. */
export function __resetRecordingConfigCache(): void {
  cachedConfig = null
  inflight = null
}

export function useRecordingConfig(): RecordingConfig {
  const [config, setConfig] = useState<RecordingConfig>(cachedConfig ?? DEFAULT_CONFIG)
  useEffect(() => {
    let cancelled = false
    void fetchRecordingConfigOnce().then((c) => {
      if (!cancelled) setConfig(c)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return config
}
