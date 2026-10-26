'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { Fragment, Slice } from '@tiptap/pm/model'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Extension, JSONContent } from '@tiptap/core'
import { createScreenplayExtensions } from '@/lib/screenwriting/schema/extensions'
import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { autoDetectElementType, nextElementType } from '@/lib/screenwriting/editor/element-keys'
import { elementTypeForDigit } from '@/lib/screenwriting/editor/shortcuts'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'
import { usePageDecorations } from '@/components/screenwriting/use-page-decorations'
import { useCommentInlineHighlights, type CommentHighlight } from '@/components/screenwriting/use-comment-inline-highlights'
import { shouldDisablePmHistory, collabUndoStackLabel } from '@/lib/screenwriting/collab/undo-policy'
import { attachYjsUndoHook } from '@/lib/screenwriting/collab/yjs-undo-hook'
import type * as Y from 'yjs'
import { replaceYdocFromPmJson, seedYdocFromPmJson } from '@/lib/screenwriting/collab/seed-ydoc'
import { pastePlainTextToElements } from '@/lib/screenwriting/editor/clipboard'
import { elementDirection } from '@/lib/screenwriting/editor/rtl'
import { macroForHotkey, type Macro } from '@/lib/screenwriting/editor/macros'
import { hashPmJson, reconcileSave } from '@/lib/screenwriting/persistence/save-reconcile'
import { offlineDraftKeys } from '@/lib/screenwriting/persistence/offline-draft'
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
  collabLive,
  onCollabLive,
  collabExtensions,
  ydoc,
  highlightCharacter,
  rtl,
  insertElementType,
  macros,
  insertImageUrl,
  smartTypeLists,
  onSmartTypeChange,
  externalDoc,
  externalDocKey,
  commentHighlights,
  activeCommentThreadId,
  onBreakdownTag,
  onEditorReady,
  pageLocked,
}: {
  scriptId: string
  formatSpec: FormatSpec
  initialDoc: JSONContent
  layoutDoc?: JSONContent | null
  onSaveState?: (state: 'saving' | 'saved' | 'error' | 'offline') => void
  onDocChange?: (doc: JSONContent) => void
  revisionColor?: string
  collabLive?: boolean
  onCollabLive?: (v: boolean) => void
  collabExtensions: Extension[]
  ydoc: Y.Doc
  highlightCharacter?: string
  rtl?: boolean
  insertElementType?: string | null
  macros?: Macro[]
  insertImageUrl?: string | null
  smartTypeLists?: SmartTypeLists
  onSmartTypeChange?: (lists: SmartTypeLists) => void
  externalDoc?: JSONContent | null
  externalDocKey?: number
  commentHighlights?: CommentHighlight[]
  activeCommentThreadId?: string | null
  onBreakdownTag?: (payload: { elementId: string; from: number; to: number; text: string }) => void
  onEditorReady?: (editor: import('@tiptap/react').Editor) => void
  pageLocked?: boolean
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverUpdatedAt = useRef(0)
  const lists = smartTypeLists ?? DEFAULT_SMARTTYPE
  const [suggestItems, setSuggestItems] = useState<string[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const extensions = useMemo(() => {
    const base = createScreenplayExtensions(formatSpec).filter((e) => {
      if (shouldDisablePmHistory()) return e.name !== 'history'
      return true
    })
    return [...base, ...collabExtensions]
  }, [formatSpec, collabExtensions])

  const dir = elementDirection(Boolean(rtl))

  const editor = useEditor({
    extensions,
    content: undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'sw-editor max-w-none focus:outline-none sw-print-preview',
        spellcheck: 'true',
        style: `direction: ${dir.direction}; text-align: ${dir.textAlign}`,
        'data-undo-label': collabUndoStackLabel(Boolean(collabLive)),
        'data-yjs-undo': '1',
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
        if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
          event.preventDefault()
          const { state } = view
          const { $from, from, to } = state.selection
          if ($from.parent.type.name !== 'screenplayElement') return true
          const elementId = $from.parent.attrs.id as string
          const text = state.doc.textBetween(from, to, '')
          onBreakdownTag?.({
            elementId,
            from: from - $from.start(),
            to: to - $from.start(),
            text,
          })
          return true
        }
        if (pageLocked) {
          return false
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
    onCreate: ({ editor: ed }) => {
      seedYdocFromPmJson(ydoc, ed.schema, initialDoc)
      onCollabLive?.(Boolean(collabLive))
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
            const keys = offlineDraftKeys(scriptId)
            try {
              localStorage.setItem(keys.syncedHash, deviceHash)
              localStorage.setItem(keys.updatedAt, String(serverAt))
              localStorage.setItem(keys.doc, JSON.stringify(json))
            } catch {
              /* quota */
            }
            onSaveState?.('saved')
          })
          .catch(() => onSaveState?.('error'))
      }, 600)
    },
  })

  const lastExternalKey = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!editor || externalDocKey === undefined || !externalDoc) return
    if (lastExternalKey.current === externalDocKey) return
    lastExternalKey.current = externalDocKey
    if (externalDocKey === 0) return
    replaceYdocFromPmJson(ydoc, editor.schema, externalDoc)
  }, [editor, externalDoc, externalDocKey, ydoc])

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
  useCommentInlineHighlights(editor, commentHighlights ?? [], activeCommentThreadId)

  useEffect(() => {
    if (editor) onEditorReady?.(editor)
  }, [editor, onEditorReady])

  useEffect(() => {
    const root = editor?.view.dom
    if (!root) return
    attachYjsUndoHook(root, true)
    root.setAttribute('data-undo-label', collabUndoStackLabel(Boolean(collabLive)))
  }, [editor, collabLive])

  useEffect(() => {
    const root = editor?.view.dom
    if (!root || !revisionColor) return
    root.setAttribute('data-revision', revisionColor)
  }, [editor, revisionColor])

  if (!editor) return <p className="text-sm text-muted-foreground">Loading editor…</p>

  return (
    <div className="sw-editor-stage relative">
      {suggestOpen ? (
        <div className="absolute left-8 top-2 z-50">
          <SmartTypeMenu items={suggestItems} onPick={applySmartPick} />
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
