'use client'

import { ClipboardList, MessageSquareText, PhoneForwarded } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useAgent } from '@/components/providers/agent-provider'
import { MessageTakingEditor } from '@/components/receptionist/message-taking-editor'
import { IntakeFieldsEditor, QualificationRulesEditor } from '@/components/receptionist/intake-qualification-editor'
import { isConversationalIvrEditor } from '@/lib/receptionist/runtime-profile'
import { Section, ToggleRow } from './ai-ui'

export function CallerIntakePageContent() {
  const { draft, update } = useAgent()
  const ivr = isConversationalIvrEditor(draft)

  if (ivr) {
    return <MessageTakingEditor />
  }

  return (
    <div className="flex flex-col gap-6">
      <MessageTakingEditor />

      <Section
        id="callbacks"
        icon={PhoneForwarded}
        title="Callback requests"
        description="Separate from general messages — use when the caller wants someone to call them back."
      >
        <ToggleRow
          title="Allow callback requests"
          description="Recognizes phrases like “call me back” and creates a tracked callback for your team."
          checked={draft.messages.callbacks}
          onChange={(v) => {
            update('messages', (m) => ({ ...m, callbacks: v }))
            update('capabilities', (c) => ({ ...c, message: c.message || v }))
          }}
        />
      </Section>

      <Section id="intake-fields" icon={ClipboardList} title="Structured intake" description="What to collect beyond a simple message.">
        <IntakeFieldsEditor />
      </Section>

      <Section id="qualification" icon={MessageSquareText} title="Qualification" description="Optional rules for qualified leads — not every caller is a sales lead.">
        {draft.capabilities.qualify ? (
          <QualificationRulesEditor />
        ) : (
          <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            <p>Turn on qualification in Agent Settings → Capabilities when you want intake rules to affect routing or follow-up.</p>
            <Label className="flex items-center gap-2 font-normal">
              <Switch
                checked={false}
                onCheckedChange={() => update('capabilities', (c) => ({ ...c, qualify: true }))}
                aria-label="Enable qualify callers"
              />
              Enable qualify callers
            </Label>
          </div>
        )}
      </Section>
    </div>
  )
}
