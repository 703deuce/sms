'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { useAgent } from '@/components/providers/agent-provider'
import { toast } from 'sonner'
import type { KnowledgeProfile } from '@/lib/agent'

function Field({
  id,
  label,
  description,
  value,
  onChange,
  rows = 4,
}: {
  id: string
  label: string
  description: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function KnowledgeProfileEditor() {
  const { draft, update, saveDraft, unsaved } = useAgent()
  const kp = draft.knowledgeProfile

  const patch = (partial: Partial<KnowledgeProfile>) => {
    update('knowledgeProfile', (prev) => ({ ...prev, ...partial }))
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Business knowledge" description="Authoritative facts Ava may state on calls. Publish after edits so live calls use the latest text.">
        <div className="flex flex-col gap-4">
          <Field
            id="kp-business"
            label="Business overview"
            description="Company name, what you do, locations, hours, service area — the facts callers ask about most."
            value={kp.businessOverview}
            onChange={(v) => patch({ businessOverview: v })}
            rows={5}
          />
          <Field
            id="kp-pricing"
            label="Pricing"
            description="List prices or ranges you are comfortable stating on the phone."
            value={kp.pricing}
            onChange={(v) => patch({ pricing: v })}
            rows={3}
          />
          <Field
            id="kp-payment"
            label="Payment methods"
            description="Cards, insurance, financing, etc."
            value={kp.paymentMethods}
            onChange={(v) => patch({ paymentMethods: v })}
            rows={2}
          />
          <Field
            id="kp-policies"
            label="Policies"
            description="Cancellation, insurance, refunds, and other standing rules."
            value={kp.policies}
            onChange={(v) => patch({ policies: v })}
            rows={4}
          />
        </div>
      </Panel>

      <Panel title="Agent job" description="What this receptionist is responsible for on every call — injected into the Voice V3 frontend and backend prompts.">
        <Field
          id="kp-job"
          label="Job description"
          description="Example: Answer professionally, book hygiene visits, transfer dental emergencies, never quote treatment prices beyond approved knowledge."
          value={kp.agentJob}
          onChange={(v) => patch({ agentJob: v })}
          rows={5}
        />
      </Panel>
    </div>
  )
}
