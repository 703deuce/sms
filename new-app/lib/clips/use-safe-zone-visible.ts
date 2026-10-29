'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'transovo.safeZone'

export function useSafeZoneVisible(): [boolean, (v: boolean) => void] {
  const [visible, setVisibleState] = useState(false)

  useEffect(() => {
    try {
      setVisibleState(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      setVisibleState(false)
    }
  }, [])

  const setVisible = useCallback((v: boolean) => {
    setVisibleState(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    } catch {
      /* preview-only preference */
    }
  }, [])

  return [visible, setVisible]
}
