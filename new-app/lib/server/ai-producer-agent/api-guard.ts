import { NextResponse } from 'next/server'
import { aiProducerAgentServerEnabled } from '@/lib/ai-producer-agent/flags'

export function aiProducerAgentDisabledResponse(): NextResponse | null {
  if (!aiProducerAgentServerEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return null
}
