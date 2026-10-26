import { mergeAttributes, Node } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'
import History from '@tiptap/extension-history'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'

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

export const ScreenplayElement = Node.create({
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
    }
  },
  parseHTML: () => [{ tag: 'div[data-screenplay-element]' }],
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-screenplay-element': '', class: 'sw-element' }), 0]
  },
  addCommands() {
    return {
      insertScreenplayElement:
        (elementType: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: 'screenplayElement',
            attrs: { id: newElementId(), elementType },
            content: [{ type: 'text', text: '' }],
          }),
    }
  },
})

export const screenplayExtensions = [
  ScreenplayDocument,
  Text,
  History,
  ScreenplayElement,
  DualDialogue,
  DialogueColumn,
  PageBreak,
]
