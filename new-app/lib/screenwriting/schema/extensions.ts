import { Extension, mergeAttributes, Node } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'
import History from '@tiptap/extension-history'
import { TextSelection } from '@tiptap/pm/state'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'
import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { elementStyle } from '@/lib/screenwriting/editor/element-style'
import { cssPropertiesToString } from '@/lib/screenwriting/editor/style-string'
import { nextElementType } from '@/lib/screenwriting/editor/element-keys'

export const ScreenplayDocument = Document.extend({
  content: '(screenplayElement | dualDialogue | pageBreak)+',
})

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': '', class: 'sw-page-break' }],
})

export const DialogueColumn = Node.create({
  name: 'dialogueColumn',
  content: '(screenplayElement)+',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-dialogue-column]' }],
  renderHTML: () => ['div', { 'data-dialogue-column': '', class: 'sw-dialogue-column' }, 0],
})

export const DualDialogue = Node.create({
  name: 'dualDialogue',
  group: 'block',
  content: 'dialogueColumn{2}',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-dual-dialogue]' }],
  renderHTML: () => ['div', { 'data-dual-dialogue': '', class: 'sw-dual-dialogue' }, 0],
})

export function createScreenplayElementNode(formatSpec: FormatSpec) {
  return Node.create({
    name: 'screenplayElement',
    group: 'block',
    content: 'text*',
    defining: true,
    addAttributes() {
      return {
        id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (a) => ({ 'data-id': a.id }) },
        elementType: {
          default: 'action',
          parseHTML: (el) => el.getAttribute('data-element-type') || 'action',
          renderHTML: (a) => ({ 'data-element-type': a.elementType }),
        },
        imageSrc: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-image-src'),
          renderHTML: (a) => (a.imageSrc ? { 'data-image-src': a.imageSrc } : {}),
        },
        synopsis: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-synopsis'),
          renderHTML: (a) => (a.synopsis ? { 'data-synopsis': a.synopsis } : {}),
        },
        revisedMark: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-revised'),
          renderHTML: (a) => (a.revisedMark ? { 'data-revised': a.revisedMark } : {}),
        },
      }
    },
    parseHTML: () => [{ tag: 'div[data-screenplay-element]' }],
    renderHTML({ node, HTMLAttributes }) {
      const type = (node.attrs.elementType || 'action') as ScreenplayElementType
      const style = cssPropertiesToString(elementStyle(formatSpec, type))
      const revised = node.attrs.revisedMark ? '*' : ''
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-screenplay-element': '',
          class: 'sw-element',
          style,
        }),
        ['span', { class: 'sw-revised-mark', style: 'display:none' }, revised],
        0,
      ]
    },
    addCommands() {
      return {
        insertScreenplayElement:
          (elementType: string) =>
          ({ commands }: { commands: { insertContent: (c: object) => boolean } }) =>
            commands.insertContent({
              type: 'screenplayElement',
              attrs: { id: newElementId(), elementType },
              content: [{ type: 'text', text: '' }],
            }),
      } as Record<string, unknown>
    },
  })
}

export function createScreenplayKeymap(formatSpec: FormatSpec) {
  return Extension.create({
    name: 'screenplayKeymap',
    priority: 1000,
    addKeyboardShortcuts() {
      return {
        Enter: ({ editor }) => {
          const { state, view } = editor
          const { $from } = state.selection
          if ($from.parent.type.name !== 'screenplayElement') return false
          const current = ($from.parent.attrs.elementType || 'action') as ScreenplayElementType
          const next = nextElementType(current, 'enter')
          if (next === 'stay') return false
          const insertPos = $from.parentOffset === $from.parent.content.size ? $from.after() : $from.pos
          let tr = state.tr
          if ($from.parentOffset === $from.parent.content.size) {
            const node = state.schema.nodes.screenplayElement.create({
              attrs: { id: newElementId(), elementType: next },
            })
            tr = tr.insert(insertPos, node)
            tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
          } else {
            tr = tr.split($from.pos, 1, [
              state.schema.nodes.screenplayElement.create({
                attrs: { id: newElementId(), elementType: next },
              }),
            ])
          }
          view.dispatch(tr.scrollIntoView())
          return true
        },
        Tab: ({ editor }) => {
          const { state, view } = editor
          const { $from } = state.selection
          if ($from.parent.type.name !== 'screenplayElement') return false
          const current = ($from.parent.attrs.elementType || 'action') as ScreenplayElementType
          const next = nextElementType(current, 'tab')
          if (next === 'stay') return false
          const pos = $from.before($from.depth)
          view.dispatch(
            state.tr.setNodeMarkup(pos, undefined, { ...$from.parent.attrs, elementType: next }).scrollIntoView(),
          )
          return true
        },
        'Shift-Tab': ({ editor }) => {
          const { state, view } = editor
          const { $from } = state.selection
          if ($from.parent.type.name !== 'screenplayElement') return false
          const current = ($from.parent.attrs.elementType || 'action') as ScreenplayElementType
          const next = nextElementType(current, 'shiftTab')
          if (next === 'stay') return false
          const pos = $from.before($from.depth)
          view.dispatch(
            state.tr.setNodeMarkup(pos, undefined, { ...$from.parent.attrs, elementType: next }).scrollIntoView(),
          )
          return true
        },
      }
    },
  })
}

export function createScreenplayExtensions(formatSpec: FormatSpec = FEATURE_FORMAT_SPEC) {
  return [
    ScreenplayDocument,
    Text,
    History,
    createScreenplayElementNode(formatSpec),
    DualDialogue,
    DialogueColumn,
    PageBreak,
    createScreenplayKeymap(formatSpec),
  ]
}

/** @deprecated use createScreenplayExtensions(formatSpec) */
export const screenplayExtensions = createScreenplayExtensions(FEATURE_FORMAT_SPEC)
