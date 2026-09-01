'use client'

import { Users, Megaphone, Rocket, ChevronLeft, Clock } from 'lucide-react'
import { CampaignDraft, creditsAvailable } from '../mock-data'
import PhonePreview from './PhonePreview'

interface Props {
  draft: CampaignDraft
  onPrev: () => void
  onSend: () => void
}

function SectionHead({ label, onEdit, hint }: { label: string; onEdit?: () => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-semibold text-foreground">
        {label}
        {hint && <em className="ml-1.5 text-xs font-normal not-italic text-muted-foreground">({hint})</em>}
      </span>
      {onEdit && (
        <button
          className="text-xs font-semibold text-primary transition hover:text-primary/80"
          onClick={onEdit}
        >
          Edit
        </button>
      )}
    </div>
  )
}

export default function ReviewDetails({ draft, onPrev, onSend }: Props) {
  const contacts = Math.max(draft.audience.length, 1)
  const creditsRequired = contacts * (draft.attachment ? 3 : 1)
  const remaining = creditsAvailable - creditsRequired

  const timingLabel =
    draft.timing === 'now'
      ? 'Send Immediately'
      : draft.timing === 'later'
        ? 'Scheduled for Later'
        : 'Recurring'

  return (
    <div className="pb-20">
      <button
        onClick={onPrev}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft size={13} />
        Create Campaign
      </button>
      <div className="mt-2 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Megaphone size={18} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Review Details</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Confirm your campaign details.</p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Audience */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHead label="Audience" hint="Subscribed Contacts Only" onEdit={onPrev} />
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users size={13} />
                </span>
                List: {draft.audience[0] || 'VIP List'}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
                {contacts}
              </span>
            </div>
          </div>

          {/* Timing */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHead label="Timing" onEdit={onPrev} />
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-[13px] font-medium text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Clock size={13} />
              </span>
              {timingLabel}
            </div>
          </div>

          {/* Credit summary */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <SectionHead label="Message Credit Summary" />
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                <span className="text-muted-foreground">Credits Available</span>
                <span className="font-medium tabular-nums text-foreground">
                  {creditsAvailable.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[13px]">
                <span className="text-muted-foreground">Credits Required</span>
                <span className="font-medium tabular-nums text-foreground">
                  {creditsRequired.toLocaleString()}
                  {draft.attachment && (
                    <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                      MMS ×3
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5 text-[13px]">
                <span className="font-semibold text-foreground">Credits Remaining</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {remaining.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <PhonePreview message={draft.message} attachment={draft.attachment} label="Campaign Preview" />
        </div>
      </div>

      {/* Footer bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <button
            className="inline-flex h-9 items-center gap-1 rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onPrev}
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Save Draft
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
              onClick={onSend}
            >
              Send Now
              <Rocket size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
