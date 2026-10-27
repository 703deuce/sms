'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  compositionTabChannel,
  createTabId,
  type TabLockMessage,
} from '@/lib/clips/script-editor/composition-tab-lock'

export function useCompositionTabLock(compositionId: string) {
  const tabIdRef = useRef(createTabId())
  const claimAtRef = useRef(Date.now())
  const foreignClaimAtRef = useRef(0)
  const [foreignTab, setForeignTab] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

  const syncReadOnly = useCallback(() => {
    const foreignWins = foreignClaimAtRef.current > claimAtRef.current
    setForeignTab(foreignWins)
    setReadOnly(foreignWins)
  }, [])

  const claim = useCallback(() => {
    claimAtRef.current = Date.now()
    foreignClaimAtRef.current = 0
    setReadOnly(false)
    setForeignTab(false)
    const ch = compositionTabChannel(compositionId)
    ch?.postMessage({ type: 'claim', tabId: tabIdRef.current, at: claimAtRef.current })
  }, [compositionId])

  useEffect(() => {
    const ch = compositionTabChannel(compositionId)
    if (!ch) return

    const onMessage = (ev: MessageEvent<TabLockMessage>) => {
      const msg = ev.data
      if (!msg || msg.tabId === tabIdRef.current) return
      if (msg.type === 'claim') {
        foreignClaimAtRef.current = msg.at
        syncReadOnly()
        ch.postMessage({ type: 'ping', tabId: tabIdRef.current, at: claimAtRef.current })
      }
      if (msg.type === 'ping' && 'at' in msg) {
        foreignClaimAtRef.current = Math.max(foreignClaimAtRef.current, msg.at)
        syncReadOnly()
      }
      if (msg.type === 'release') {
        foreignClaimAtRef.current = 0
        syncReadOnly()
      }
    }

    ch.addEventListener('message', onMessage)
    claimAtRef.current = Date.now()
    ch.postMessage({ type: 'claim', tabId: tabIdRef.current, at: claimAtRef.current })

    const ping = window.setInterval(() => {
      ch.postMessage({ type: 'ping', tabId: tabIdRef.current, at: claimAtRef.current })
    }, 4000)

    return () => {
      window.clearInterval(ping)
      ch.postMessage({ type: 'release', tabId: tabIdRef.current })
      ch.removeEventListener('message', onMessage)
      ch.close()
    }
  }, [compositionId, syncReadOnly])

  return { foreignTab, readOnly, setReadOnly, claimEditingHere: claim }
}
