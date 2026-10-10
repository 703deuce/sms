'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import type { ArAppointmentRow } from '@/lib/appointment-reminders/appointments-page-types'
import { KeyValueRow } from '@/newui-transplant/components/app/kit'
import { ReminderStatusPill } from '@/newui-transplant/components/appointment-reminders/reminder-status-pill'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import type {
  ArCustomerActionHistoryItem,
  ArCustomerResponseSummary,
  ArReminderEngagementStep,
  ArSmsEvidenceSummary,
} from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'

type DetailPayload = {
  serviceName?: string
  inviteeName?: string
  startsAt: string
  endsAt?: string | null
  timezone?: string | null
  metadata?: Record<string, unknown>
  reminderSchedule?: Array<{ label: string; scheduledFor?: string; status: string; detail?: string }>
}

type TimelineEntry = { label: string; scheduledFor?: string; status: string; detail?: string }

export function AppointmentDetailDrawer({
  row,
  open,
  onClose,
  timezone,
  onPhoneSaved,
}: {
  row: ArAppointmentRow | null
  open: boolean
  onClose: () => void
  timezone: string
  onPhoneSaved: () => void
}) {
  const [detail, setDetail] = useState<DetailPayload | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [phoneEdit, setPhoneEdit] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [approvalBusy, setApprovalBusy] = useState<'approve' | 'reject' | null>(null)
  const [approvalError, setApprovalError] = useState('')
  const [customerResponse, setCustomerResponse] = useState<ArCustomerResponseSummary | null>(null)
  const [reminderEngagement, setReminderEngagement] = useState<ArReminderEngagementStep[]>([])
  const [actionHistory, setActionHistory] = useState<ArCustomerActionHistoryItem[]>([])
  const [evidenceSummary, setEvidenceSummary] = useState<ArSmsEvidenceSummary | null>(null)
  const [dispatches, setDispatches] = useState<
    Array<{ timelineType: string; channel: string; status: string; scheduledFor: string | null }>
  >([])
  const [recipientChannel, setRecipientChannel] = useState<'sms' | 'email' | 'both'>('both')

  const loadDetail = useCallback(async () => {
    if (!row?.id) return
    setLoading(true)
    try {
      const [apptRes, tlRes] = await Promise.all([
        fetch(`/api/appointment-reminders/appointments/${row.id}`),
        fetch(`/api/appointment-reminders/appointments/${row.id}/reminder-timeline`),
      ])
      const apptJson = apptRes.ok ? await apptRes.json() : null
      const tlJson = tlRes.ok ? await tlRes.json() : null
      setDetail(apptJson?.data ?? null)
      const future = (tlJson?.data?.future || []) as TimelineEntry[]
      const past = (tlJson?.data?.timeline || []).map(
        (e: { label?: string; type?: string; at?: string; detail?: string }) => ({
          label: e.label || e.type || 'Reminder',
          scheduledFor: e.at,
          status: e.type?.includes('failed') ? 'Failed' : 'Sent',
          detail: e.detail,
        }),
      )
      const merged = [
        ...future.map((f) => ({
          label: f.label,
          scheduledFor: f.scheduledFor,
          status: f.status === 'scheduled' ? 'Scheduled' : f.status,
        })),
        ...past,
      ]
      setTimeline(merged.length ? merged : apptJson?.data?.reminderSchedule || [])
      setCustomerResponse((tlJson?.data?.customerResponse as ArCustomerResponseSummary) ?? row.customerResponse)
      setReminderEngagement((tlJson?.data?.reminderEngagement as ArReminderEngagementStep[]) || [])
      setActionHistory((tlJson?.data?.customerActionHistory as ArCustomerActionHistoryItem[]) || [])
      setEvidenceSummary((tlJson?.data?.evidenceSummary as ArSmsEvidenceSummary) || null)
      setDispatches((tlJson?.data?.dispatches as typeof dispatches) || [])
      const ch = (apptJson?.data?.metadata as { recipientNotificationChannel?: string })
        ?.recipientNotificationChannel
      if (ch === 'sms' || ch === 'email' || ch === 'both') setRecipientChannel(ch)
      setPhoneEdit(row.phone || '')
    } finally {
      setLoading(false)
    }
  }, [row])

  useEffect(() => {
    if (open && row) void loadDetail()
  }, [open, row, loadDetail])

  async function savePhone() {
    if (!row) return
    setSavingPhone(true)
    setPhoneError('')
    try {
      const res = await fetch(`/api/appointment-reminders/appointments/${row.id}/reminder-contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneEdit }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not save phone')
      onPhoneSaved()
      await loadDetail()
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : 'Could not save phone')
    } finally {
      setSavingPhone(false)
    }
  }

  const tz = row?.timezone || timezone
  const meta = (detail?.metadata || {}) as Record<string, unknown>
  const provider = String(meta.provider || row?.sourceProvider || '')
  const consentLabel =
    meta.smsCapable === false || meta.emailOnly
      ? 'Consent required'
      : 'Eligible under workspace reminder policy'

  const rescheduleReq = (row?.arRescheduleRequest ||
    (meta.arRescheduleRequest as ArAppointmentRow['arRescheduleRequest'])) as
    | ArAppointmentRow['arRescheduleRequest']
    | undefined
  const pendingReschedule =
    rescheduleReq &&
    (rescheduleReq.status === 'pending_approval' ||
      rescheduleReq.status === 'pending_business' ||
      rescheduleReq.status === 'processing')
  const rescheduleLocked =
    rescheduleReq &&
    (rescheduleReq.status === 'approved' ||
      rescheduleReq.status === 'rejected' ||
      rescheduleReq.status === 'expired' ||
      rescheduleReq.status === 'failed')

  async function approveReschedule() {
    if (!row) return
    setApprovalBusy('approve')
    setApprovalError('')
    try {
      const res = await fetch('/api/appointment-reminders/ai-rescheduler/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: row.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Approval failed')
      onPhoneSaved()
      await loadDetail()
    } catch (e) {
      setApprovalError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setApprovalBusy(null)
    }
  }

  async function rejectReschedule() {
    if (!row) return
    setApprovalBusy('reject')
    setApprovalError('')
    try {
      const res = await fetch('/api/appointment-reminders/ai-rescheduler/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: row.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Rejection failed')
      onPhoneSaved()
      await loadDetail()
    } catch (e) {
      setApprovalError(e instanceof Error ? e.message : 'Rejection failed')
    } finally {
      setApprovalBusy(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-[480px]">
        {row ? (
          <>
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle className="text-base font-semibold">
                {row.appointmentTitle || row.customerName}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">{row.customerName}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTimeRange(row.startsAt, row.endsAt, tz, row.isAllDay)}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <ReminderStatusPill label={row.reminder.label} status={row.reminder.status} />
                {customerResponse ? (
                  <CustomerResponsePill
                    label={customerResponse.label}
                    kind={customerResponse.kind}
                  />
                ) : null}
              </div>
              {customerResponse?.detailLine ? (
                <p className="text-xs text-muted-foreground">{customerResponse.detailLine}</p>
              ) : null}
              {customerResponse?.reasonLine ? (
                <p className="text-xs text-muted-foreground">{customerResponse.reasonLine}</p>
              ) : null}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {loading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading details…
                </p>
              ) : (
                <div className="space-y-6">
                  {customerResponse && customerResponse.kind !== 'none' ? (
                    <section className="rounded-lg border bg-muted/20 px-4 py-3">
                      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Customer action
                      </h2>
                      <dl className="space-y-2 text-sm">
                        {evidenceSummary?.customerAction ? (
                          <KeyValueRow label="Channel" value={evidenceSummary.customerAction} />
                        ) : (
                          <KeyValueRow label="Outcome" value={customerResponse.label} />
                        )}
                        {evidenceSummary?.policyWindowLabel ? (
                          <KeyValueRow label="Policy" value={evidenceSummary.policyWindowLabel} />
                        ) : null}
                        {evidenceSummary?.acceptanceStatus &&
                        evidenceSummary.acceptanceStatus !== 'not_required' ? (
                          <KeyValueRow
                            label="Customer acceptance"
                            value={
                              evidenceSummary.acceptanceStatus === 'recorded'
                                ? 'Recorded'
                                : evidenceSummary.acceptanceStatus === 'pending'
                                  ? 'Pending'
                                  : 'Declined'
                            }
                          />
                        ) : null}
                        {evidenceSummary?.consequenceLabel ? (
                          <KeyValueRow label="Consequence" value={evidenceSummary.consequenceLabel} />
                        ) : null}
                      </dl>
                    </section>
                  ) : null}

                  <section>
                    <h2 className="mb-3 text-sm font-semibold">Appointment details</h2>
                    <dl className="space-y-2">
                      <KeyValueRow label="Customer" value={row.customerName} />
                      {row.appointmentTitle ? (
                        <KeyValueRow label="Appointment" value={row.appointmentTitle} />
                      ) : null}
                      <KeyValueRow
                        label="Date"
                        value={formatDate(row.startsAt, tz)}
                      />
                      <KeyValueRow
                        label="Time"
                        value={formatTimeRange(row.startsAt, row.endsAt, tz, row.isAllDay)}
                      />
                      {row.sourceCalendarLabel ? (
                        <KeyValueRow label="Calendar" value={row.sourceCalendarLabel} />
                      ) : null}
                      {provider ? (
                        <KeyValueRow
                          label="Source"
                          value={provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}
                        />
                      ) : null}
                    </dl>
                  </section>

                  {rescheduleReq ? (
                    <section>
                      <h2 className="mb-3 text-sm font-semibold">Reschedule request</h2>
                      <dl className="mb-3 space-y-2">
                        <KeyValueRow label="Status" value={formatRescheduleStatus(rescheduleReq.status)} />
                        {rescheduleReq.requestedAt ? (
                          <KeyValueRow
                            label="Requested"
                            value={new Date(rescheduleReq.requestedAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                              timeZone: tz,
                            })}
                          />
                        ) : null}
                        {rescheduleReq.proposedStartsAt ? (
                          <KeyValueRow
                            label="Requested time"
                            value={new Date(rescheduleReq.proposedStartsAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                              timeZone: tz,
                            })}
                          />
                        ) : null}
                        {row.sourceCalendarLabel ? (
                          <KeyValueRow
                            label="Calendar"
                            value={`${row.sourceProvider === 'microsoft' ? 'Outlook' : row.sourceProvider === 'google' ? 'Google' : 'Calendar'} · ${row.sourceCalendarLabel}`}
                          />
                        ) : null}
                        {'failureReason' in (rescheduleReq as object) &&
                        (rescheduleReq as { failureReason?: string }).failureReason ? (
                          <KeyValueRow
                            label="Error"
                            value={(rescheduleReq as { failureReason?: string }).failureReason || ''}
                          />
                        ) : null}
                        <KeyValueRow
                          label="Original time"
                          value={formatDateTimeRange(row.startsAt, row.endsAt, tz, row.isAllDay)}
                        />
                      </dl>
                      {approvalError ? (
                        <p className="mb-2 text-xs text-destructive" role="alert">{approvalError}</p>
                      ) : null}
                      {pendingReschedule ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={approveReschedule}
                            disabled={approvalBusy !== null || rescheduleReq.status === 'processing'}
                          >
                            {approvalBusy === 'approve' || rescheduleReq.status === 'processing'
                              ? 'Approving…'
                              : 'Approve reschedule'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={rejectReschedule}
                            disabled={approvalBusy !== null || rescheduleReq.status === 'processing'}
                          >
                            {approvalBusy === 'reject' ? 'Rejecting…' : 'Reject'}
                          </Button>
                        </div>
                      ) : rescheduleLocked ? (
                        <p className="text-xs text-muted-foreground">This request is closed.</p>
                      ) : null}
                    </section>
                  ) : null}

                  <section>
                    <h2 className="mb-3 text-sm font-semibold">Reminder contact</h2>
                    <dl className="mb-3 space-y-2">
                      <KeyValueRow
                        label="Phone"
                        value={
                          row.phone
                            ? formatPhone(row.phone)
                            : row.phoneState === 'invalid'
                              ? 'Invalid phone'
                              : 'Missing phone'
                        }
                      />
                      <KeyValueRow label="Consent" value={consentLabel} />
                    </dl>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="ar-phone">
                        Reminder phone (saved in Transovo only)
                      </label>
                      <Input
                        id="ar-phone"
                        value={phoneEdit}
                        onChange={(e) => setPhoneEdit(e.target.value)}
                        placeholder="+1 703 555 0142"
                        autoComplete="tel"
                      />
                      {phoneError ? (
                        <p className="text-xs text-destructive" role="alert">{phoneError}</p>
                      ) : null}
                      <Button size="sm" onClick={savePhone} disabled={savingPhone}>
                        {savingPhone ? 'Saving…' : 'Save phone number'}
                      </Button>
                    </div>
                  </section>

                  {actionHistory.length > 0 ? (
                    <section>
                      <h2 className="mb-3 text-sm font-semibold">Customer action history</h2>
                      <ol className="space-y-4 border-l border-border pl-4">
                        {actionHistory.map((item, i) => (
                          <li key={`${item.at}-${item.kind}-${i}`} className="relative text-sm">
                            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border" />
                            <p className="font-medium">{item.label}</p>
                            {item.messageText ? (
                              <p className="mt-1 text-xs text-foreground">
                                {item.actor === 'customer' ? 'Customer: ' : item.actor === 'transovo' ? 'Transovo: ' : ''}
                                &ldquo;{item.messageText}&rdquo;
                              </p>
                            ) : null}
                            {item.detailLine ? (
                              <p className="text-xs text-muted-foreground">{item.detailLine}</p>
                            ) : null}
                            {item.calendarResult === 'verified' ? (
                              <p className="text-xs text-muted-foreground">Calendar update verified</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.at).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                                timeZone: tz,
                              })}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : null}

                  {dispatches.length > 0 ? (
                    <section>
                      <h2 className="mb-3 text-sm font-semibold">Delivery ledger</h2>
                      <ul className="space-y-2 text-sm">
                        {dispatches.map((d) => (
                          <li key={d.timelineType} className="rounded-md border px-3 py-2">
                            <p className="font-medium">{d.timelineType}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.channel.toUpperCase()} · {d.status}
                              {d.scheduledFor
                                ? ` · intended ${new Date(d.scheduledFor).toLocaleString(undefined, { timeZone: tz })}`
                                : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <section>
                    <h2 className="mb-3 text-sm font-semibold">Reminders &amp; customer actions</h2>
                    {reminderEngagement.length > 0 ? (
                      <ol className="space-y-4 border-l border-border pl-4">
                        {reminderEngagement.map((step) => (
                          <li key={step.timelineType} className="relative text-sm">
                            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary/60" />
                            <p className="font-medium">{step.reminderLabel}</p>
                            {step.sentAt ? (
                              <p className="text-xs text-muted-foreground">
                                Sent {new Date(step.sentAt).toLocaleString(undefined, { timeZone: tz })}
                              </p>
                            ) : null}
                            {step.customerResponse ? (
                              <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2">
                                <p className="text-xs font-medium text-foreground">
                                  {step.customerResponse.label}
                                </p>
                                {step.customerResponse.detailLine ? (
                                  <p className="text-xs text-muted-foreground">
                                    {step.customerResponse.detailLine}
                                  </p>
                                ) : null}
                                {step.customerResponse.reasonLine ? (
                                  <p className="text-xs text-muted-foreground">
                                    {step.customerResponse.reasonLine}
                                  </p>
                                ) : null}
                                {step.customerResponse.at ? (
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(step.customerResponse.at).toLocaleString(undefined, {
                                      timeZone: tz,
                                    })}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No customer response yet</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : timeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No reminders sent yet.</p>
                    ) : (
                      <ol className="space-y-3 border-l border-border pl-4">
                        {timeline.map((step, i) => (
                          <li key={`${step.label}-${i}`} className="relative text-sm">
                            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border" />
                            <p className="font-medium">{step.label}</p>
                            {step.scheduledFor ? (
                              <p className="text-xs text-muted-foreground">
                                Scheduled for {new Date(step.scheduledFor).toLocaleString()}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">Status: {step.status}</p>
                            {step.detail ? (
                              <p className="text-xs text-destructive">{step.detail}</p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              )}
            </div>

            <footer className="flex gap-2 border-t px-5 py-4">
              {row.sourceEventUrl ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(row.sourceEventUrl!, '_blank', 'noopener,noreferrer')}
                >
                  Open in calendar
                </Button>
              ) : null}
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
            </footer>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function formatDate(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  })
}

function formatTimeRange(
  start: string,
  end: string | null,
  tz: string,
  allDay: boolean,
) {
  if (allDay) return 'All day'
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: tz }
  const a = new Date(start).toLocaleTimeString(undefined, opts)
  const b = end ? new Date(end).toLocaleTimeString(undefined, opts) : ''
  return b ? `${a} – ${b}` : a
}

function formatRescheduleStatus(status: string) {
  switch (status) {
    case 'pending_approval':
      return 'Pending approval'
    case 'pending_business':
      return 'Pending business follow-up'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'failed':
      return 'Failed'
    case 'processing':
      return 'Processing'
    case 'expired':
      return 'Expired'
    default:
      return status
  }
}

function formatDateTimeRange(
  start: string,
  end: string | null,
  tz: string,
  allDay: boolean,
) {
  if (allDay) return `${formatDate(start, tz)} · All day`
  return `${formatDate(start, tz)} · ${formatTimeRange(start, end, tz, false)}`
}
