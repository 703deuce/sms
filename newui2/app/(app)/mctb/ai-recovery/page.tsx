import type { Metadata } from 'next'
import { AiRecoveryForm } from '@/components/mctb/ai-recovery-form'

export const metadata: Metadata = { title: 'AI Recovery' }

export default function AiRecoveryPage() {
  return <AiRecoveryForm />
}
