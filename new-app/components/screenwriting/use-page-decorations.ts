'use client'

import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { useScriptLayout } from '@/components/screenwriting/use-script-layout'
import type { JSONContent } from '@tiptap/core'

/** Visual page gaps from layout engine (authoritative breaks). */
export function usePageDecorations(editor: Editor | null, doc: JSONContent | null) {
  const layout = useScriptLayout(doc)
  useEffect(() => {
    if (!editor || !layout?.pages.length) return
    const root = editor.view.dom
    root.querySelectorAll('.sw-page-gap').forEach((el) => el.remove())
    layout.pages.forEach((page, idx) => {
      if (idx === 0) return
      const gap = document.createElement('div')
      gap.className = 'sw-page-gap border-t-2 border-dashed border-muted my-6 pt-2 text-center text-xs text-muted-foreground'
      gap.textContent = `Page ${page.label}`
      const first = root.querySelector(`[data-id="${page.startAnchor.elementId}"]`)
      first?.parentElement?.insertBefore(gap, first)
    })
  }, [editor, layout])
}
