'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import Collaboration from '@tiptap/extension-collaboration'
import { Extension } from '@tiptap/core'
import { yUndoPlugin } from 'y-prosemirror'
import { createScreenplayUndoManager } from '@/lib/screenwriting/collab/yjs-undo'

export type CollabMode = 'connecting' | 'live' | 'local'

export type CollabStatus = {
  mode: CollabMode
  reason: string
}

function yUndoExtension(undoManager: Y.UndoManager) {
  return Extension.create({
    name: 'yUndo',
    addProseMirrorPlugins() {
      return [yUndoPlugin({ undoManager })]
    },
  })
}

export function useScreenplayYjsCollab(scriptId: string) {
  const ydoc = useMemo(() => new Y.Doc(), [scriptId])
  const undoManager = useMemo(() => createScreenplayUndoManager(ydoc), [ydoc])
  const [status, setStatus] = useState<CollabStatus>({ mode: 'connecting', reason: 'Connecting to collaboration…' })
  const providerRef = useRef<HocuspocusProvider | null>(null)

  const collabExtensions = useMemo(
    () => [
      Collaboration.configure({ document: ydoc, field: 'prosemirror' }),
      yUndoExtension(undoManager),
    ],
    [ydoc, undoManager],
  )

  useEffect(() => {
    let cancelled = false
    let connectTimer: ReturnType<typeof setTimeout> | undefined

    void (async () => {
      try {
        const res = await fetch(`/api/sw/scripts/${scriptId}/collab-token`, { method: 'POST' })
        if (!res.ok || cancelled) {
          setStatus({
            mode: 'local',
            reason: 'Collaboration token failed — using local Yjs undo (single writer).',
          })
          return
        }
        const { data } = await res.json()
        const url = (data?.url as string) || ''
        const token = data?.token as string
        const configured = Boolean(data?.liveCollabConfigured)
        if (!configured) {
          setStatus({
            mode: 'local',
            reason:
              'Live collab not configured on this deploy (set SW_COLLAB_WS_URL + SW_COLLAB_SECRET and run services/collab). Edits save over HTTP; Yjs undo is local-only.',
          })
          return
        }
        if (!url || !token) {
          setStatus({
            mode: 'local',
            reason: 'Collaboration token missing — Yjs undo is local-only.',
          })
          return
        }

        const provider = new HocuspocusProvider({
          url,
          name: `sw/${scriptId}`,
          token,
          document: ydoc,
          onConnect: () => {
            if (cancelled) return
            setStatus({ mode: 'live', reason: '' })
          },
          onDisconnect: () => {
            if (cancelled) return
            setStatus({
              mode: 'local',
              reason: 'Collaboration server disconnected — edits save via HTTP; reconnecting…',
            })
          },
          onAuthenticationFailed: () => {
            setStatus({
              mode: 'local',
              reason: 'Collaboration auth failed — check SW_COLLAB_SECRET / token.',
            })
          },
        })
        providerRef.current = provider

        let connected = false
        provider.on('connect', () => {
          connected = true
        })
        connectTimer = setTimeout(() => {
          if (cancelled || connected) return
          setStatus({
            mode: 'local',
            reason:
              'Collaboration server unreachable (deploy services/collab or fix SW_COLLAB_WS_URL). Local Yjs undo only.',
          })
        }, 6000)
      } catch {
        setStatus({
          mode: 'local',
          reason: 'Collaboration offline — local Yjs undo only.',
        })
      }
    })()

    return () => {
      cancelled = true
      if (connectTimer) clearTimeout(connectTimer)
      providerRef.current?.destroy()
      providerRef.current = null
      undoManager.destroy()
      ydoc.destroy()
    }
  }, [scriptId, ydoc, undoManager])

  return { ydoc, collabExtensions, status, undoManager }
}
