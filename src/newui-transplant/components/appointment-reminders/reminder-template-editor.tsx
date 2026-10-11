'use client'

import { useMemo, type ReactNode } from 'react'
import { mergeTemplate } from '@/lib/messaging/template'
import { estimateSmsSegments } from '@/lib/utils'
import {
  extractTemplateVariables,
  validateTemplateVariables,
} from '@/lib/appointment-reminders/template-library/validate-template'
import {
  exampleReminderMergeVars,
  renderReminderTemplatePreview,
} from '@/lib/appointment-reminders/template-library/preview-vars'
import { Button } from '@/newui-transplant/components/ui/button'
import { Textarea } from '@/newui-transplant/components/ui/textarea'

const VAR_CHIP_CLASS =
  'rounded bg-red-500/15 px-1 py-0.5 font-mono text-[11px] text-red-700 dark:text-red-300'

function highlightVariables(template: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}|\{([a-z_]+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    const start = m.index
    if (start > last) parts.push(template.slice(last, start))
    const token = m[0]
    parts.push(
      <span key={`${start}-${token}`} className={VAR_CHIP_CLASS}>
        {token}
      </span>,
    )
    last = start + token.length
  }
  if (last < template.length) parts.push(template.slice(last))
  return parts.length ? parts : [template]
}

export type ReminderTemplateEditorProps = {
  channel: 'sms' | 'email'
  template: string
  emailSubject?: string
  readOnly?: boolean
  mergeTags: string[]
  businessName: string
  timezone: string
  businessPhone?: string
  location?: string
  customMergeFields?: Record<string, string>
  onTemplateChange: (value: string) => void
  onEmailSubjectChange?: (value: string) => void
  onInsertTag: (tag: string) => void
}

export function ReminderTemplateEditor({
  channel,
  template,
  emailSubject,
  readOnly,
  mergeTags,
  businessName,
  timezone,
  businessPhone,
  location,
  customMergeFields,
  onTemplateChange,
  onEmailSubjectChange,
  onInsertTag,
}: ReminderTemplateEditorProps) {
  const exampleVars = useMemo(
    () =>
      exampleReminderMergeVars({
        businessName,
        timezone,
        businessPhone,
        location,
        customMergeFields,
      }),
    [businessName, timezone, businessPhone, location, customMergeFields],
  )

  const rendered = useMemo(
    () => renderReminderTemplatePreview(template, exampleVars),
    [template, exampleVars],
  )

  const subjectRendered = useMemo(() => {
    if (channel !== 'email' || !emailSubject?.trim()) return ''
    return mergeTemplate(emailSubject, exampleVars)
  }, [channel, emailSubject, exampleVars])

  const { characters, segments } = estimateSmsSegments(template || '')
  const validation = validateTemplateVariables(template, exampleVars)
  const unknownVars = extractTemplateVariables(template).filter(
    (v) => !(v in exampleVars) && v !== 'join_meeting_line',
  )

  return (
    <div className="space-y-4">
      {channel === 'email' && onEmailSubjectChange ? (
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Email subject</span>
          <Textarea
            className="min-h-[44px] font-mono text-sm"
            value={emailSubject || ''}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => onEmailSubjectChange(e.target.value)}
          />
          {subjectRendered ? (
            <p className="mt-1 text-xs text-muted-foreground">Preview: {subjectRendered}</p>
          ) : null}
        </label>
      ) : null}

      <div>
        <span className="mb-1.5 block text-sm font-medium">Message</span>
        <div
          className="mb-2 min-h-[48px] rounded-lg border border-dashed bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap"
          aria-hidden={readOnly ? undefined : true}
        >
          {highlightVariables(template)}
        </div>
        <Textarea
          className="min-h-[160px] font-mono text-sm leading-relaxed"
          value={template}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onTemplateChange(e.target.value)}
          aria-label="Reminder message template"
        />
        {channel === 'sms' ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {characters} characters · {segments || 1} SMS segment{(segments || 1) === 1 ? '' : 's'}
          </p>
        ) : null}
        {validation.missing.length > 0 ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Missing at send time: {validation.missing.join(', ')}
          </p>
        ) : null}
        {validation.warnings.length > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Empty optional variables: {validation.warnings.join(', ')}
          </p>
        ) : null}
        {unknownVars.length > 0 ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Unrecognized variables: {unknownVars.join(', ')}
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Insert variable
        </p>
        <div className="flex flex-wrap gap-1.5">
          {mergeTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px]"
              disabled={readOnly}
              onClick={() => onInsertTag(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live preview
        </p>
        <div className="rounded-xl border bg-muted/25 p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {rendered}
        </div>
      </div>
    </div>
  )
}
