import type { Metadata } from 'next'
import { TextBackEditor } from '@/components/mctb/text-back-editor'

export const metadata: Metadata = { title: 'Text Back' }

export default function TextBackPage() {
  return <TextBackEditor />
}
