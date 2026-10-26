'use client'

import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * W10: fetch collab token; when Hocuspocus URL is configured, provider wiring
 * lives in services/collab. Editor stays fully functional without WS.
 */
export function useScreenplayCollab(editor: Editor | null, scriptId: string) {
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/sw/scripts/${scriptId}/collab-token`, { method: 'POST' })
        if (!res.ok || cancelled) return
        const { data } = await res.json()
        if (typeof window !== 'undefined' && data?.token) {
          editor.view.dom.setAttribute('data-collab-url', data.url || '')
          editor.view.dom.setAttribute('data-collab-ready', '1')
        }
      } catch {
        /* offline / local mode */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editor, scriptId])
}
