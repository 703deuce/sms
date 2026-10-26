'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect, useMemo, useRef } from 'react'
import type { JSONContent } from '@tiptap/core'
import { screenplayExtensions } from '@/lib/screenwriting/schema/extensions'
import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { elementStyle } from '@/lib/screenwriting/editor/element-style'
import { autoDetectElementType, nextElementType } from '@/lib/screenwriting/editor/element-keys'
import { elementTypeForDigit } from '@/lib/screenwriting/editor/shortcuts'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'

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
      handleKeyDown: (view, event) => {
        const mod = event.metaKey || event.ctrlKey
        if (mod && !event.shiftKey && !event.altKey) {
          const digit = Number(event.key)
          const elType = elementTypeForDigit(digit)
          if (elType) {
            event.preventDefault()
            const { state, dispatch } = view
            const { $from } = state.selection
            const depth = $from.depth
            const pos = $from.before(depth)
            const node = $from.node(depth)
            if (node.type.name === 'screenplayElement') {
              const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, elementType: elType })
              dispatch(tr)
            }
            return true
          }
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          const { state, dispatch } = view
          const { $from } = state.selection
          const node = $from.parent
          if (node.type.name !== 'screenplayElement') return false
          const current = (node.attrs.elementType || 'action') as ScreenplayElementType
          const next = nextElementType(current, 'enter')
          event.preventDefault()
          const tr = state.tr.split($from.pos, 1, [{ type: state.schema.nodes.screenplayElement, attrs: { id: newElementId(), elementType: next } }])
          dispatch(tr.scrollIntoView())
          return true
        }
        if (event.key === 'Tab') {
          const { state, dispatch } = view
          const { $from } = state.selection
          const node = $from.parent
          if (node.type.name !== 'screenplayElement') return false
          const current = (node.attrs.elementType || 'action') as ScreenplayElementType
          const action = event.shiftKey ? 'shiftTab' : 'tab'
          const next = nextElementType(current, action)
          if (next === 'stay') return false
          event.preventDefault()
          const pos = $from.before($from.depth)
          const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, elementType: next })
          dispatch(tr)
          return true
        }
        if (event.key === 'Backspace') {
          const { state, dispatch } = view
          const { $from } = state.selection
          const node = $from.parent
          if (node.type.name !== 'screenplayElement' || node.textContent.length > 0 || !$from.parentOffset) return false
          const current = (node.attrs.elementType || 'action') as ScreenplayElementType
          const prev = nextElementType(current, 'backspaceEmpty')
          if (prev === 'stay') return false
          event.preventDefault()
          const pos = $from.before($from.depth)
          const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, elementType: prev })
          dispatch(tr)
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      onSaveState?.('saving')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const json = ed.getJSON()
      if (Array.isArray(json.content)) {
        for (const block of json.content) {
          if (block.type === 'screenplayElement' && typeof block.attrs?.elementType === 'string') {
            const text = (block.content?.[0] as { text?: string })?.text ?? ''
            const detected = autoDetectElementType(text, block.attrs.elementType as ScreenplayElementType)
            if (detected !== block.attrs.elementType) {
              block.attrs.elementType = detected
            }
          }
        }
      }
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/sw/scripts/${scriptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pmJson: json }),
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
