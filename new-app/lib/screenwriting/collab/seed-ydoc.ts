import type { Schema } from '@tiptap/pm/model'
import type { JSONContent } from '@tiptap/core'
import * as Y from 'yjs'
import { prosemirrorJSONToYXmlFragment } from 'y-prosemirror'

export function seedYdocFromPmJson(ydoc: Y.Doc, schema: Schema, pmJson: JSONContent, field = 'prosemirror'): boolean {
  const fragment = ydoc.getXmlFragment(field)
  if (fragment.length > 0) return false
  prosemirrorJSONToYXmlFragment(schema, pmJson as Record<string, unknown>, fragment)
  return true
}

export function replaceYdocFromPmJson(ydoc: Y.Doc, schema: Schema, pmJson: JSONContent, field = 'prosemirror'): void {
  const fragment = ydoc.getXmlFragment(field)
  fragment.delete(0, fragment.length)
  prosemirrorJSONToYXmlFragment(schema, pmJson as Record<string, unknown>, fragment)
}
