'use client'

import { useState } from 'react'
import { Paperclip, Smile, Code2, Send, X, Users, Megaphone, ChevronLeft, List, PieChart } from 'lucide-react'
import { CampaignDraft, lists, segments, sampleAttachment } from '../mock-data'
import PhonePreview from './PhonePreview'
import MmsModal from './MmsModal'

interface Props {
  draft: CampaignDraft
  onChange: (d: CampaignDraft) => void
  onCancel: () => void
  onReview: (d: CampaignDraft) => void
}

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-foreground'
const inputCls =
  'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'

export default function CreateCampaign({ draft, onChange, onCancel, onReview }: Props) {
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [audienceQuery, setAudienceQuery] = useState('')
  const [showMmsModal, setShowMmsModal] = useState(false)
  const [attachTooltip, setAttachTooltip] = useState(false)
  const [testTooltip, setTestTooltip] = useState(false)

  const hasAttachment = !!draft.attachment
  const charLimit = hasAttachment ? 1600 : 918

  const addAudience = (name: string) => {
    if (!draft.audience.includes(name)) {
      onChange({ ...draft, audience: [...draft.audience, name] })
    }
    setAudienceQuery('')
  }

  const removeAudience = (name: string) => {
    onChange({ ...draft, audience: draft.audience.filter((a) => a !== name) })
  }

  const attachFile = () => {
    if (hasAttachment) return
    setShowMmsModal(true)
  }

  const confirmAttach = () => {
    onChange({ ...draft, attachment: sampleAttachment })
    setShowMmsModal(false)
  }

  const removeAttachment = () => onChange({ ...draft, attachment: null })

  const filteredLists = lists.filter((l) => l.toLowerCase().includes(audienceQuery.toLowerCase()))
  const filteredChartPie = segments.filter((s) => s.toLowerCase().includes(audienceQuery.toLowerCase()))
  const canReview = draft.name.trim().length > 0 && draft.message.trim().length > 0

  const timingLabels: Record<CampaignDraft['timing'], string> = {
    now: 'Now',
    later: 'Later',
    recurring: 'Recurring',
  }

  return (
    <div className="pb-20">
      {/* Breadcrumb + header */}
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft size={13} />
        Campaigns
      </button>
      <div className="mt-2 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Megaphone size={18} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Create Campaign</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Create a campaign to reach your contacts at scale.
          </p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <label className={labelCls}>Campaign Name</label>
              <input
                className={inputCls}
                value={draft.name}
                placeholder="e.g. Black Friday Dress Sale"
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
              />
            </div>

            <div className="relative">
              <label className={labelCls}>Audience</label>
              <div
                className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                onClick={() => setAudienceOpen(true)}
              >
                {draft.audience.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 py-1 pl-2 pr-1 text-xs font-medium text-primary"
                  >
                    <Users size={11} />
                    {a}
                    <button
                      className="flex h-4 w-4 items-center justify-center rounded-sm transition hover:bg-primary/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAudience(a)
                      }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-[90px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder={draft.audience.length ? '' : 'Search lists & segments'}
                  value={audienceQuery}
                  onChange={(e) => {
                    setAudienceQuery(e.target.value)
                    setAudienceOpen(true)
                  }}
                  onFocus={() => setAudienceOpen(true)}
                />
              </div>
              {audienceOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAudienceOpen(false)} />
                  <div className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg">
                    <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Everyone
                    </div>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-foreground transition hover:bg-muted"
                      onClick={() => addAudience('All Contacts')}
                    >
                      <Users size={14} className="text-muted-foreground" />
                      All Contacts
                    </button>
                    {filteredLists.length > 0 && (
                      <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Lists
                      </div>
                    )}
                    {filteredLists.map((l) => (
                      <button
                        key={l}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-foreground transition hover:bg-muted"
                        onClick={() => addAudience(l)}
                      >
                        <List size={14} className="text-muted-foreground" />
                        {l}
                      </button>
                    ))}
                    {filteredChartPie.length > 0 && (
                      <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Segments
                      </div>
                    )}
                    {filteredChartPie.map((s) => (
                      <button
                        key={s}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-foreground transition hover:bg-muted"
                        onClick={() => addAudience(s)}
                      >
                        <PieChart size={14} className="text-muted-foreground" />
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[13px] font-semibold text-foreground">Message</label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {draft.message.length}/{charLimit.toLocaleString()}
                  {hasAttachment && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                      MMS ×3
                    </span>
                  )}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-border bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <textarea
                  className="min-h-32 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
                  placeholder="Write your message…"
                  value={draft.message}
                  maxLength={charLimit}
                  onChange={(e) => onChange({ ...draft, message: e.target.value })}
                />
                {hasAttachment && (
                  <div className="px-3 pb-2">
                    <div className="relative inline-block">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-lg text-2xl ring-1 ring-border"
                        style={{ background: draft.attachment!.color }}
                      >
                        👕
                      </div>
                      <button
                        className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition hover:opacity-80"
                        onClick={removeAttachment}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border bg-muted/30 px-2 py-1.5">
                  <div className="flex items-center gap-0.5">
                    <button
                      className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
                      onMouseEnter={() => setAttachTooltip(true)}
                      onMouseLeave={() => setAttachTooltip(false)}
                      onClick={attachFile}
                      disabled={hasAttachment}
                    >
                      <Paperclip size={15} />
                      {attachTooltip && (
                        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-md">
                          Attach a File
                        </span>
                      )}
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">
                      <Smile size={15} />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">
                      <Code2 size={15} />
                    </button>
                  </div>
                  <button
                    className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    onMouseEnter={() => setTestTooltip(true)}
                    onMouseLeave={() => setTestTooltip(false)}
                  >
                    <Send size={14} />
                    {testTooltip && (
                      <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-md">
                        Send a Test
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>When to Send</label>
              <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
                {(['now', 'later', 'recurring'] as const).map((t) => (
                  <button
                    key={t}
                    className={`h-8 rounded-md px-4 text-[13px] font-medium transition ${
                      draft.timing === t
                        ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => onChange({ ...draft, timing: t })}
                  >
                    {timingLabels[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-6">
          <PhonePreview message={draft.message} attachment={draft.attachment} />
        </div>
      </div>

      {/* Footer bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <button
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onCancel}
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Save Draft
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              disabled={!canReview}
              onClick={() => onReview(draft)}
            >
              Review →
            </button>
          </div>
        </div>
      </div>

      {showMmsModal && <MmsModal onClose={confirmAttach} />}
    </div>
  )
}
