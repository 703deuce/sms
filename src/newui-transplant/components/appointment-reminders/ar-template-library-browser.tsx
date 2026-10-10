'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  INDUSTRY_LABELS,
  MESSAGE_TYPE_LABELS,
  type TemplateMessageType,
} from '@/lib/appointment-reminders/template-library/types'
import { EmptyState, Panel } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Input } from '@/newui-transplant/components/ui/input'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { ReminderTemplateEditor } from '@/newui-transplant/components/appointment-reminders/reminder-template-editor'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { REMINDER_MERGE_TAGS } from '@/features/appointments/kimi/reminders/map-reminders'

type SummaryRow = {
  id: string
  industry: string
  messageType: TemplateMessageType
  channel: 'sms' | 'email'
  label: string
  preview: string
}

type TemplateDetail = {
  id: string
  industry: string
  messageType: TemplateMessageType
  channel: 'sms' | 'email'
  label: string
  subject: string | null
  body: string
}

type Props = {
  businessName: string
  timezone: string
  businessPhone?: string
  location?: string
  templateLocked?: boolean
  onApplyToStep?: (detail: TemplateDetail) => void
}

export function ArTemplateLibraryBrowser({
  businessName,
  timezone,
  businessPhone,
  location,
  templateLocked,
  onApplyToStep,
}: Props) {
  const [industries, setIndustries] = useState<Array<{ id: string; label: string }>>([])
  const [industry, setIndustry] = useState('all')
  const [channel, setChannel] = useState('all')
  const [messageType, setMessageType] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TemplateDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    void fetch('/api/appointment-reminders/templates/library')
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data?.industries || []) as Array<{ id: string; label: string }>
        setIndustries(list.map((i) => ({ id: i.id, label: i.label })))
      })
      .catch(() => setIndustries([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams({ summaries: '1', page: String(page), pageSize: '50' })
      if (industry !== 'all') sp.set('industry', industry)
      if (channel !== 'all') sp.set('channel', channel)
      if (messageType !== 'all') sp.set('messageType', messageType)
      if (q.trim()) sp.set('q', q.trim())
      const res = await fetch(`/api/appointment-reminders/templates/library?${sp}`)
      const json = await res.json()
      setRows(json.data?.rows || [])
      setTotal(json.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [channel, industry, messageType, page, q])

  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
  }, [load])

  const openDetail = async (row: SummaryRow) => {
    setDetailLoading(true)
    setEditorOpen(true)
    try {
      const sp = new URLSearchParams({
        industry: row.industry,
        messageType: row.messageType,
        channel: row.channel,
      })
      const res = await fetch(`/api/appointment-reminders/templates/library?${sp}`)
      const json = await res.json()
      setSelected(json.data as TemplateDetail)
    } catch {
      setSelected(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / 50))

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-3 lg:w-[240px]">
        <Panel title="Filters" bodyClassName="space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 flex items-center gap-2 font-medium">
              <Search className="size-3.5" aria-hidden="true" />
              Search
            </span>
            <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} placeholder="Template text…" className="h-9" />
          </label>
          <SimpleSelect
            label="Industry"
            value={industry}
            onChange={(v) => { setPage(1); setIndustry(v) }}
            options={[{ value: 'all', label: 'All industries' }, ...industries.map((i) => ({ value: i.id, label: i.label }))]}
          />
          <SimpleSelect
            label="Channel"
            value={channel}
            onChange={(v) => { setPage(1); setChannel(v) }}
            options={[
              { value: 'all', label: 'SMS and email' },
              { value: 'sms', label: 'SMS' },
              { value: 'email', label: 'Email' },
            ]}
          />
          <SimpleSelect
            label="Message type"
            value={messageType}
            onChange={(v) => { setPage(1); setMessageType(v) }}
            options={[
              { value: 'all', label: 'All types' },
              ...Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
        </Panel>
        <p className="text-xs text-muted-foreground">{total} templates in library</p>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={th}>Template</th>
                <th scope="col" className={th}>Industry</th>
                <th scope="col" className={th}>Channel</th>
                <th scope="col" className={th}>Purpose</th>
                <th scope="col" className={th}>Preview</th>
                <th scope="col" className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" aria-hidden="true" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <EmptyState title="No templates match" description="Try different filters or search terms." />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className={`${td} font-medium`}>{row.label}</td>
                    <td className={td}>{INDUSTRY_LABELS[row.industry] || row.industry}</td>
                    <td className={td}>{row.channel === 'email' ? 'Email' : 'SMS'}</td>
                    <td className={td}>{MESSAGE_TYPE_LABELS[row.messageType] || row.messageType}</td>
                    <td className={`${td} max-w-[200px] truncate text-muted-foreground`}>{row.preview}</td>
                    <td className={td}>
                      <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(row)}>
                        Preview
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 ? (
          <div className="mt-3 flex items-center justify-between text-sm">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-muted-foreground">Page {page} of {pageCount}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>{selected?.label || 'Template preview'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {detailLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading template…
              </p>
            ) : selected ? (
              <ReminderTemplateEditor
                channel={selected.channel}
                template={selected.body}
                emailSubject={selected.subject || ''}
                readOnly={Boolean(templateLocked && selected.channel === 'sms')}
                mergeTags={REMINDER_MERGE_TAGS}
                businessName={businessName}
                timezone={timezone}
                businessPhone={businessPhone}
                location={location}
                onTemplateChange={() => {}}
                onEmailSubjectChange={() => {}}
                onInsertTag={() => {}}
              />
            ) : null}
          </div>
          {selected && onApplyToStep ? (
            <footer className="flex gap-2 border-t px-5 py-4">
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  onApplyToStep(selected)
                  setEditorOpen(false)
                }}
              >
                Use template
              </Button>
            </footer>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
