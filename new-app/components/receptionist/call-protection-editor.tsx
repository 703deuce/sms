'use client'

import { ShieldAlert } from 'lucide-react'
import { SimpleSelect } from '@/components/app/filters'
import { useAgent } from '@/components/providers/agent-provider'
import type { SpamRule } from '@/lib/agent'
import { Section } from './ai-ui'

const SPAM_LABEL: Record<SpamRule['kind'], string> = {
  spam_likely: 'Spam likely',
  solicitor: 'Unwanted solicitor',
  blocked: 'Blocked numbers',
}

const SPAM_ACTION: Record<SpamRule['action'], string> = {
  allow: 'Allow',
  screen: 'Screen politely',
  message: 'Take message',
  end: 'End call',
}

export function CallProtectionEditor() {
  const { draft, update } = useAgent()

  return (
    <Section
      id="protection"
      icon={ShieldAlert}
      title="Unwanted callers"
      defaultOpen={false}
      description="Optional screening for solicitors and spam. Legitimate new customers should not be blocked by default."
    >
      <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
        {draft.protection.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{SPAM_LABEL[r.kind]}</span>
              <span className="text-xs text-muted-foreground">{r.note}</span>
            </div>
            <SimpleSelect
              label={`${SPAM_LABEL[r.kind]} action`}
              className="w-48"
              value={r.action}
              onChange={(v) =>
                update('protection', (list) => list.map((x) => (x.id === r.id ? { ...x, action: v } : x)))
              }
              options={(Object.keys(SPAM_ACTION) as SpamRule['action'][]).map((a) => ({
                value: a,
                label: SPAM_ACTION[a],
              }))}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}
