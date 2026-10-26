'use client'

import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export type CommentHighlight = {
  threadId: string
  elementId: string
  anchorFrom: number
  anchorTo: number
}

const key = new PluginKey('swCommentHighlights')

export function useCommentInlineHighlights(editor: Editor | null, highlights: CommentHighlight[], activeThreadId?: string | null) {
  useEffect(() => {
    if (!editor) return
    const plugin = new Plugin({
      key,
      props: {
        decorations(state) {
          const decos: Decoration[] = []
          const doc = state.doc
          doc.descendants((node, pos) => {
            if (node.type.name !== 'screenplayElement') return
            const id = node.attrs.id as string
            for (const h of highlights) {
              if (h.elementId !== id) continue
              const from = Number(h.anchorFrom) || 0
              const to = Number(h.anchorTo) || node.content.size
              const start = pos + 1 + Math.min(from, node.content.size)
              const end = pos + 1 + Math.min(to, node.content.size)
              if (end <= start) continue
              decos.push(
                Decoration.inline(start, end, {
                  class: h.threadId === activeThreadId ? 'sw-comment-highlight-active' : 'sw-comment-highlight',
                }),
              )
            }
          })
          return DecorationSet.create(doc, decos)
        },
      },
    })
    editor.registerPlugin(plugin)
    return () => {
      editor.unregisterPlugin(key)
    }
  }, [editor, highlights, activeThreadId])
}
