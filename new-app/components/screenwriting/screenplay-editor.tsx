'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect, useMemo, useRef } from 'react'
import type { JSONContent } from '@tiptap/core'
import { screenplayExtensions } from '@/lib/screenwriting/schema/extensions'
import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { elementStyle } from '@/lib/screenwriting/editor/element-style'

export function ScreenplayEditor({
  scriptId,
  formatSpec,
  initialDoc,
  onSaveState,
}: {
  scriptId: string
  formatSpec: FormatSpec
  initialDoc: JSONContent
  onSaveState?: (state: 'saving' | 'saved' | 'error') => void
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const extensions = useMemo(() => screenplayExtensions, [])

  const editor = useEditor({
    extensions,
    content: initialDoc,
    editorProps: {
      attributes: {
        class: 'sw-editor prose prose-sm max-w-none focus:outline-none min-h-[70vh] px-8 py-6',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onSaveState?.('saving')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/sw/scripts/${scriptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pmJson: ed.getJSON() }),
        })
          .then((r) => {
            if (!r.ok) throw new Error('save failed')
            onSaveState?.('saved')
          })
          .catch(() => onSaveState?.('error'))
      }, 600)
    },
  })

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    const root = document.querySelector('.sw-editor')
    if (!root || !editor) return
    const update = () => {
      root.querySelectorAll('[data-screenplay-element]').forEach((el) => {
        const type = (el.getAttribute('data-element-type') || 'action') as ScreenplayElementType
        const style = elementStyle(formatSpec, type)
        Object.assign((el as HTMLElement).style, style)
      })
    }
    update()
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor, formatSpec])

  if (!editor) return <p className="text-sm text-muted-foreground">Loading editor…</p>

  return <EditorContent editor={editor} />
}
