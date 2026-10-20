'use client'

import { MessageSquareText, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useAgent } from '@/components/providers/agent-provider'
import { Section, ToggleRow } from './ai-ui'

export function MessageTakingEditor() {
  const { draft, update } = useAgent()
  const mt = draft.messageTaking ?? {
    enabled: true,
    questions: [],
    additionalInstructions: '',
  }

  const setMt = (patch: Partial<typeof mt>) => {
    update('messageTaking', { ...mt, ...patch })
  }

  const questions = mt.questions ?? []

  const addQuestion = () => {
    setMt({ questions: [...questions, ''] })
  }

  const updateQuestion = (index: number, text: string) => {
    setMt({
      questions: questions.map((q, i) => (i === index ? text : q)),
    })
  }

  const removeQuestion = (index: number) => {
    setMt({ questions: questions.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-6">
      <Section
        id="message-taking-enable"
        icon={MessageSquareText}
        title="Message taking"
        description="Questions are conversational guidance — not required form fields. The agent should not re-ask what callers already said."
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Allow callers to leave a message</p>
            <p className="text-xs text-muted-foreground">Offer message taking when transfer is unavailable or the caller prefers it.</p>
          </div>
          <Switch
            checked={mt.enabled}
            onCheckedChange={(on) => {
              setMt({ enabled: on })
              update('messages', (m) => ({ ...m, takeMessage: on }))
              update('capabilities', (c) => ({ ...c, message: on }))
            }}
            aria-label="Allow message taking"
          />
        </div>
      </Section>

      {mt.enabled && (
        <>
          <Section id="message-questions" icon={MessageSquareText} title="Questions to ask" description="Plain-language prompts the agent may cover naturally.">
            <ul className="flex flex-col gap-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input
                    value={q}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    placeholder="What are you calling about?"
                    aria-label={`Question ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeQuestion(i)}
                    aria-label="Remove question"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus data-icon="inline-start" />
              Add question
            </Button>
          </Section>

          <Section id="message-instructions" icon={MessageSquareText} title="Additional instructions" description="Optional guidance for natural message-taking flow.">
            <Textarea
              rows={4}
              value={mt.additionalInstructions}
              onChange={(e) => setMt({ additionalInstructions: e.target.value })}
              placeholder="If someone is calling about a new project, ask what kind of work they need. If they already provided the information, do not ask again."
            />
          </Section>

          <Section id="message-delivery" icon={MessageSquareText} title="Message delivery" description="Uses your existing notification settings.">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="msg-email">Email recipients</Label>
                <Input
                  id="msg-email"
                  value={draft.messages.emailRecipients}
                  onChange={(e) => update('messages', (m) => ({ ...m, emailRecipients: e.target.value }))}
                  placeholder="team@example.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="msg-sms">SMS notification numbers</Label>
                <Input
                  id="msg-sms"
                  value={draft.messages.smsRecipients}
                  onChange={(e) => update('messages', (m) => ({ ...m, smsRecipients: e.target.value }))}
                  placeholder="+1…"
                />
              </div>
              <ToggleRow
                title="Urgent alerts"
                description="Notify when the caller sounds urgent."
                checked={draft.messages.urgentAlerts}
                onChange={(on) => update('messages', (m) => ({ ...m, urgentAlerts: on }))}
              />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
