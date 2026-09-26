import type { Metadata } from 'next'
import { ConsentEditor } from '@/components/mctb/consent-editor'

export const metadata: Metadata = { title: 'Consent' }

export default function ConsentPage() {
  return <ConsentEditor />
}
