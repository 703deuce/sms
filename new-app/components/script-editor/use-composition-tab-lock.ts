'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  compositionTabChannel,
  createTabId,
  type TabLockMessage,
} from '@/lib/clips/script-editor/composition-tab-lock'

export function useCompositionTabLock(compositionId: string) {
  const tabIdRef = useRef(createTabId())
  const [foreignTab, setForeignTab] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

  const claim = useCallback(() => {
    setReadOnly(false)
    setForeignTab(false)
    const ch = compositionTabChannel(compositionId)
    ch?.postMessage({ type: 'claim', tabId: tabIdRef.current, at: Date.now() })
  }, [compositionId])

  useEffect(() => {
    const ch = compositionTabChannel(compositionId)
    if (!ch) return

    const onMessage = (ev: MessageEvent<TabLockMessage>) => {
      const msg = ev.data
      if (!msg || msg.tabId === tabIdRef.current) return
      if (msg.type === 'claim' || msg.type === 'ping') {
        setForeignTab(true)
        setReadOnly(true)
        ch.postMessage({ type: 'ping', tabId: tabIdRef.current })
      }
      if (msg.type === 'release') setForeignTab(false)
    }

    ch.addEventListener('message', onMessage)
    ch.postMessage({ type: 'claim', tabId: tabIdRef.current, at: Date.now() })

    const ping = window.setInterval(() => {
      ch.postMessage({ type: 'ping', tabId: tabIdRef.current })
    }, 4000)

    return () => {
      window.clearInterval(ping)
      ch.postMessage({ type: 'release', tabId: tabIdRef.current })
      ch.removeEventListener('message', onMessage)
      ch.close()
    }
  }, [compositionId])

  return { foreignTab, readOnly, setReadOnly, claimEditingHere: claim }
}
