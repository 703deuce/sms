'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { Fragment, Slice } from '@tiptap/pm/model'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { createScreenplayExtensions } from '@/lib/screenwriting/schema/extensions'
import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { autoDetectElementType, nextElementType } from '@/lib/screenwriting/editor/element-keys'
import { elementTypeForDigit } from '@/lib/screenwriting/editor/shortcuts'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'
import { usePageDecorations } from '@/components/screenwriting/use-page-decorations'
import { useScreenplayCollab } from '@/components/screenwriting/use-screenplay-collab'
import { shouldDisablePmHistory, collabUndoStackLabel } from '@/lib/screenwriting/collab/undo-policy'
import { attachYjsUndoHook } from '@/lib/screenwriting/collab/yjs-undo-hook'
import { pastePlainTextToElements } from '@/lib/screenwriting/editor/clipboard'
import { elementDirection } from '@/lib/screenwriting/editor/rtl'
import { macroForHotkey, type Macro } from '@/lib/screenwriting/editor/macros'
import { hashPmJson, reconcileSave } from '@/lib/screenwriting/persistence/save-reconcile'
import { DEFAULT_SMARTTYPE, learnToken, type SmartTypeLists } from '@/lib/screenwriting/smarttype/store'
import { SmartTypeMenu, suggestionsForElement } from '@/components/screenwriting/smarttype-menu'
import '@/components/screenwriting/screenplay-editor.css'

export function ScreenplayEditor({
  scriptId,
  formatSpec,
  initialDoc,
  onSaveState,
  onDocChange,
  revisionColor,
  layoutDoc,
  collabActive,
  onCollabActive,
  highlightCharacter,
  rtl,
  insertElementType,
  macros,
  insertImageUrl,
  smartTypeLists,
  onSmartTypeChange,
}: {
  scriptId: string
  formatSpec: FormatSpec
  initialDoc: JSONContent
  layoutDoc?: JSONContent | null
  onSaveState?: (state: 'saving' | 'saved' | 'error' | 'offline') => void
  onDocChange?: (doc: JSONContent) => void
  revisionColor?: string
  collabActive?: boolean
  onCollabActive?: (v: boolean) => void
  highlightCharacter?: string
  rtl?: boolean
  insertElementType?: string | null
  macros?: Macro[]
  insertImageUrl?: string | null
  smartTypeLists?: SmartTypeLists
  onSmartTypeChange?: (lists: SmartTypeLists) => void
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverUpdatedAt = useRef(0)
  const lists = smartTypeLists ?? DEFAULT_SMARTTYPE
  const [suggestItems, setSuggestItems] = useState<string[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)

  const extensions = useMemo(() => {
    const base = createScreenplayExtensions(formatSpec)
    if (shouldDisablePmHistory(Boolean(collabActive))) {
      return base.filter((e) => e.name !== 'history')
    }
    return base
  }, [formatSpec, collabActive])

  const dir = elementDirection(Boolean(rtl))

  const editor = useEditor({
    extensions,
    content: initialDoc,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'sw-editor max-w-none focus:outline-none sw-print-preview',
        spellcheck: 'true',
        style: `direction: ${dir.direction}; text-align: ${dir.textAlign}`,
        'data-undo-label': collabUndoStackLabel(Boolean(collabActive)),
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain')
        if (!text || text.includes('\t')) return false
        const nodes = pastePlainTextToElements(text)
        const { state, dispatch } = view
        const frag = nodes.map((n) => state.schema.nodeFromJSON(n))
        if (!frag.length) return false
        dispatch(state.tr.replaceSelection(new Slice(Fragment.from(frag), 0, 0)).scrollIntoView())
        return true
      },
      handleKeyDown: (view, event) => {
        const macro = macroForHotkey(macros ?? [], event.key)
        if (macro?.text) {
          event.preventDefault()
          const { state, dispatch } = view
          dispatch(state.tr.insertText(macro.text))
          return true
        }
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
        if (mod && event.key === 'd') {
          event.preventDefault()
          const { state, dispatch } = view
          const dual = state.schema.nodes.dualDialogue.create(null, [
            state.schema.nodes.dialogueColumn.create(null, [
              state.schema.nodes.screenplayElement.create({ id: newElementId(), elementType: 'character' }),
              state.schema.nodes.screenplayElement.create({ id: newElementId(), elementType: 'dialogue' }),
            ]),
            state.schema.nodes.dialogueColumn.create(null, [
              state.schema.nodes.screenplayElement.create({ id: newElementId(), elementType: 'character' }),
              state.schema.nodes.screenplayElement.create({ id: newElementId(), elementType: 'dialogue' }),
            ]),
          ])
          dispatch(state.tr.replaceSelectionWith(dual))
          return true
        }
        if (mod && event.key === 'Enter') {
          event.preventDefault()
          const { state, dispatch } = view
          dispatch(state.tr.replaceSelectionWith(state.schema.nodes.pageBreak.create()))
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
      onDocChange?.(json as JSONContent)

      const { $from } = ed.state.selection
      if ($from.parent.type.name === 'screenplayElement') {
        const t = ($from.parent.attrs.elementType || 'action') as ScreenplayElementType
        const line = $from.parent.textContent
        const items = suggestionsForElement(lists, t, line)
        setSuggestItems(items)
        setSuggestOpen(items.length > 0 && line.length > 0)
      } else {
        setSuggestOpen(false)
      }

      const deviceUpdatedAt = Date.now()
      const deviceHash = hashPmJson(json)
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/sw/scripts/${scriptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pmJson: json }),
        })
          .then(async (r) => {
            if (!r.ok) throw new Error('save failed')
            const j = await r.json()
            const serverAt = j.data?.updatedAt ? new Date(j.data.updatedAt).getTime() : Date.now()
            reconcileSave({
              deviceUpdatedAt,
              serverUpdatedAt: serverUpdatedAt.current || serverAt,
              deviceHash,
              serverHash: deviceHash,
            })
            serverUpdatedAt.current = serverAt
            onSaveState?.('saved')
          })
          .catch(() => onSaveState?.('error'))
      }, 600)
    },
  })

  const applySmartPick = (value: string) => {
    if (!editor) return
    const { state, view } = editor
    const { $from } = state.selection
    if ($from.parent.type.name !== 'screenplayElement') return
    const t = ($from.parent.attrs.elementType || 'action') as ScreenplayElementType
    const from = $from.start()
    const to = $from.end()
    view.dispatch(state.tr.insertText(value, from, to))
    setSuggestOpen(false)
    if (onSmartTypeChange) {
      let next = lists
      if (t === 'character') next = { ...lists, characters: learnToken(lists.characters, value) }
      if (t === 'sceneHeading') next = { ...lists, locations: learnToken(lists.locations, value) }
      onSmartTypeChange(next)
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!editor || !insertElementType) return
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'screenplayElement',
        attrs: { id: newElementId(), elementType: insertElementType },
        content: [{ type: 'text', text: '' }],
      })
      .run()
  }, [editor, insertElementType])

  useEffect(() => {
    if (!editor || !insertImageUrl) return
    const { state, dispatch } = editor.view
    const { $from } = state.selection
    const node = $from.parent
    if (node.type.name !== 'screenplayElement') return
    const pos = $from.before($from.depth)
    dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, imageSrc: insertImageUrl }))
  }, [editor, insertImageUrl])

  useEffect(() => {
    const root = editor?.view.dom
    if (!root || !editor) return
    const update = () => {
      root.querySelectorAll('[data-screenplay-element]').forEach((el) => {
        const id = el.getAttribute('data-id')
        el.id = id ? `el-${id}` : ''
        if (highlightCharacter) {
          const t = el.getAttribute('data-element-type')
          const isChar = t === 'character' && el.textContent?.trim().toUpperCase() === highlightCharacter.toUpperCase()
          const isDial =
            t === 'dialogue' &&
            el.previousElementSibling?.getAttribute('data-element-type') === 'character' &&
            el.previousElementSibling?.textContent?.trim().toUpperCase() === highlightCharacter.toUpperCase()
          if (isChar || isDial) {
            ;(el as HTMLElement).style.backgroundColor = 'rgba(255, 230, 0, 0.25)'
          } else {
            ;(el as HTMLElement).style.backgroundColor = ''
          }
        }
      })
    }
    update()
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor, highlightCharacter])

  usePageDecorations(editor, layoutDoc ?? null)
  useScreenplayCollab(editor, scriptId)
  useEffect(() => {
    const root = editor?.view.dom
    if (!root) return
    const ready = root.getAttribute('data-collab-ready') === '1'
    if (ready) onCollabActive?.(true)
    attachYjsUndoHook(root, ready || Boolean(collabActive))
  }, [editor, collabActive, onCollabActive])

  useEffect(() => {
    const root = editor?.view.dom
    if (!root || !revisionColor) return
    root.setAttribute('data-revision', revisionColor)
  }, [editor, revisionColor])

  if (!editor) return <p className="text-sm text-muted-foreground">Loading editor…</p>

  return (
    <div className="relative">
      {suggestOpen ? (
        <div className="absolute left-8 top-2 z-50">
          <SmartTypeMenu items={suggestItems} onPick={applySmartPick} />
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
