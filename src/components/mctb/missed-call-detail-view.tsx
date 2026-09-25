"use client";

import { Button } from "@/components/ui/button";
import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_LABELS,
  MCTB_CONSENT_MODE_VERIFIED,
} from "@/lib/mctb/consent-mode";
import { classificationToTriggerLabel } from "@/lib/mctb/missed-calls-list-filters";
import { formatMissedCallLocalDateTime } from "@/lib/mctb/missed-calls-time";
import type { RecoverySuppressionPresentation } from "@/lib/mctb/recovery-suppression-presentation";
import { formatRecoveryStatus } from "@/lib/mctb/recovery-display";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  MctbPageHeader,
  MctbSectionPanel,
  MctbStatusBadge,
} from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import "./kimi-ui/reference.css";

type TimelineStep = {
  id: string;
  label: string;
  status: "pending" | "complete" | "failed" | "skipped";
  at: string | null;
};

type ConversationSummary = {
  id: string;
  unread: boolean;
  status: string;
  updatedAt: string;
  lastMessage: { body: string; createdAt: string; direction: string } | null;
};

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function primaryStatusLabel(status: string, suppressionReason: string | null) {
  return formatRecoveryStatus(status, suppressionReason);
}

export function MctbMissedCallDetailView({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return");
  const backHref = returnTo
    ? `${MCTB_ROUTES.missedCalls}?${returnTo}`
    : MCTB_ROUTES.missedCalls;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<{ consentMode: string; steps: TimelineStep[] } | null>(
    null,
  );
  const [repeatCaller, setRepeatCaller] = useState<{ total: number; missedToday: number } | null>(
    null,
  );
  const [linkClicks, setLinkClicks] = useState<
    Array<{ id: string; destinationUrl: string | null; createdAt: string }>
  >([]);
  const [formSubmissions, setFormSubmissions] = useState<
    Array<{ id: string; submittedAt: string; payloadJson: Record<string, unknown> }>
  >([]);
  const [consent, setConsent] = useState<Record<string, unknown> | null>(null);
  const [contact, setContact] = useState<{ firstName: string | null; lastName: string | null } | null>(
    null,
  );
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [voicemail, setVoicemail] = useState<{
    id: string;
    createdAt: string;
    transcriptText: string | null;
    transcriptStatus: string | null;
    aiSummary: string | null;
    durationSeconds: number | null;
  } | null>(null);
  const [showCallBack, setShowCallBack] = useState(false);
  const [lifecycle, setLifecycle] = useState<
    Array<{ at: string | null; label: string; detail: string }>
  >([]);
  const [whyNotTexted, setWhyNotTexted] = useState<RecoverySuppressionPresentation | null>(null);
  const [capturedFields, setCapturedFields] = useState<Record<string, unknown>>({});
  const [leadSummary, setLeadSummary] = useState<string | null>(null);
  const [messagingContext, setMessagingContext] = useState<{ senderLabel: string } | null>(null);
  const [bookingAction, setBookingAction] = useState<{
    allowed: boolean;
    bookingUrl?: string | null;
  } | null>(null);
  const [automation, setAutomation] = useState<{
    state: string;
    followUpStatus: string | null;
  } | null>(null);
  const [timezone, setTimezone] = useState("America/New_York");

  useEffect(() => {
    void fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load event");
        setEvent(json.event);
        setTimeline(json.timeline);
        setRepeatCaller(json.repeatCaller || null);
        setLinkClicks(json.linkClicks || []);
        setFormSubmissions(json.formSubmissions || []);
        setConsent(json.consent || null);
        setContact(json.contact || null);
        setConversation(json.conversation || null);
        setVoicemail(json.voicemail || null);
        setLifecycle(json.lifecycle || []);
        setWhyNotTexted(json.whyNotTexted || null);
        setCapturedFields(json.capturedFields || {});
        setLeadSummary(json.leadSummary || null);
        setMessagingContext(json.messagingContext || null);
        setBookingAction(json.bookingAction || null);
        setAutomation(json.automation || null);
        if (json.timezone) setTimezone(json.timezone);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [eventId]);

  const consentMode = timeline?.consentMode || "";
  const isPress1 = consentMode === MCTB_CONSENT_MODE_VERIFIED || consentMode === "press_1";
  const isExistingConsent =
    consentMode === MCTB_CONSENT_MODE_EXISTING || consentMode === "existing_consent";

  const callerLabel = useMemo(() => {
    const name = contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
      : "";
    const phone = String(event?.callerE164 || "");
    return name || fmtPhone(phone);
  }, [contact, event?.callerE164]);

  const capturedRows = useMemo(() => {
    const labels: Record<string, string> = {
      caller_name: "Name",
      NAME: "Name",
      service_reason: "What they need",
      REASON: "What they need",
      service_address: "Location",
      ADDRESS: "Location",
      urgency: "Urgency",
      URGENCY: "Urgency",
      callback_time: "Callback preference",
      CALLBACK_TIME: "Callback preference",
    };
    const rows: Array<{ label: string; value: string }> = [];
    for (const [key, raw] of Object.entries(capturedFields)) {
      if (raw == null || raw === "") continue;
      if (key.startsWith("_")) continue;
      const value = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (!value.trim()) continue;
      rows.push({ label: labels[key] || key.replace(/_/g, " "), value: value.trim() });
    }
    return rows;
  }, [capturedFields]);

  async function followUp(status: "called_back" | "resolved") {
    if (!conversation?.id) return;
    await fetch("/api/mctb/handoff/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "follow_up",
        conversationId: conversation.id,
        followUpStatus: status,
      }),
    });
    setAutomation((prev) =>
      prev ? { ...prev, followUpStatus: status, state: status === "resolved" ? "resolved" : "human_active" } : prev,
    );
  }

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card animate-pulse p-12" aria-busy="true" aria-label="Loading missed call" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <p className="text-sm text-rose-600">{error || "Missed call not found."}</p>
          <Link href={backHref} className="mt-4 inline-block text-sm font-semibold text-primary">
            ← Missed Calls
          </Link>
        </div>
      </div>
    );
  }

  const status = String(event.status || "");
  const suppressionReason =
    event.suppressionReason != null ? String(event.suppressionReason) : null;
  const primaryAction =
    status === "CUSTOMER_REPLIED" && conversation
      ? (
          <Link
            href={`/conversations?product=mctb&conversation=${conversation.id}`}
            className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Open conversation
          </Link>
        )
      : event.callerE164
        ? (
            <Button type="button" size="sm" onClick={() => setShowCallBack(true)}>
              Call customer
            </Button>
          )
        : null;

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner max-w-3xl">
        <Link href={backHref} className="text-[13px] font-semibold text-indigo-600 hover:underline">
          ← Missed Calls
        </Link>
        <div className="mt-3">
          <MctbPageHeader
            title={callerLabel}
            description={`Missed call · ${
              event.detectedAt
                ? formatMissedCallLocalDateTime(String(event.detectedAt), timezone)
                : "—"
            } · Business line ${fmtPhone(String(event.businessE164 || ""))}`}
            badge={
              <MctbStatusBadge
                tone={
                  status === "FAILED"
                    ? "attention"
                    : status === "SUPPRESSED"
                      ? "suppressed"
                      : status === "CUSTOMER_REPLIED"
                        ? "active"
                        : "ready"
                }
                label={primaryStatusLabel(status, suppressionReason)}
              />
            }
            action={primaryAction}
          />
        </div>

      <div className="space-y-4">
      <MctbSectionPanel title="Recovery lifecycle">
        <ol className="space-y-2">
          {lifecycle.map((step) => (
            <li key={`${step.label}-${step.at || "na"}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">
                {step.at ? formatMissedCallLocalDateTime(step.at, timezone) : "—"}
              </span>
              <span className="text-muted-foreground">
                {step.label}
                {step.detail ? ` · ${step.detail}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </MctbSectionPanel>

      {whyNotTexted ? (
        <MctbSectionPanel title="Why wasn’t a recovery text sent?">
          <p className="text-sm font-medium text-foreground">{whyNotTexted.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{whyNotTexted.explanation}</p>
          {whyNotTexted.unknown ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              View technical details below for more context.
            </p>
          ) : null}
        </MctbSectionPanel>
      ) : null}

      {capturedRows.length > 0 || leadSummary ? (
        <MctbSectionPanel title="Captured recovery information">
          {capturedRows.length > 0 ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {capturedRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {leadSummary ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Summary
              </p>
              <p className="mt-1 text-sm">{leadSummary}</p>
            </div>
          ) : null}
        </MctbSectionPanel>
      ) : null}

      <MctbSectionPanel title="Call details">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Caller</dt>
            <dd className="font-medium">{callerLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Business line</dt>
            <dd>{fmtPhone(String(event.businessE164 || "—"))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Missed</dt>
            <dd>{event.detectedAt ? fmtDateTime(String(event.detectedAt)) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Trigger</dt>
            <dd>{classificationToTriggerLabel(String(event.disposition || ""))}</dd>
          </div>
          {repeatCaller ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Repeat calls</dt>
              <dd>
                {repeatCaller.missedToday > 1
                  ? `${repeatCaller.missedToday} calls today`
                  : `${repeatCaller.total} prior missed call(s)`}
              </dd>
            </div>
          ) : null}
        </dl>
      </MctbSectionPanel>

      <MctbSectionPanel
        title="Consent & messaging"
        action={
          <Link href={MCTB_ROUTES.complianceConsent} className="text-sm font-semibold text-primary hover:underline">
            View consent history
          </Link>
        }
      >
        {messagingContext ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Sender: {messagingContext.senderLabel}
          </p>
        ) : null}
        {isPress1 ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Method</dt>
              <dd>{MCTB_CONSENT_MODE_LABELS.press_1.title}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Outcome</dt>
              <dd>
                {consent
                  ? "Consent captured"
                  : suppressionReason === "NOT_EXISTING_CONSENT"
                    ? "Caller did not press 1 — not captured"
                    : "Not captured"}
              </dd>
            </div>
            {consent?.consentedAt ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Captured</dt>
                <dd>{fmtDateTime(String(consent.consentedAt))}</dd>
              </div>
            ) : null}
          </dl>
        ) : isExistingConsent ? (
          <p className="text-sm text-muted-foreground">
            Existing permission mode — recovery texts rely on permission your business already has.
            No Press-1 audio or DTMF capture on this call.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Consent status unavailable.</p>
        )}
      </MctbSectionPanel>

      <MctbSectionPanel title="Text-back">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              {isPress1 ? "Compliance confirmation" : "Recovery message"}
            </dt>
            <dd className="font-medium">{formatRecoveryStatus(status, suppressionReason)}</dd>
          </div>
          {isPress1 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Recovery message</dt>
              <dd className="font-medium">
                {event.smsSentAt ? `Sent · ${fmtDateTime(String(event.smsSentAt))}` : "—"}
              </dd>
            </div>
          ) : null}
          {whyNotTexted && !event.smsSentAt ? (
            <p className="text-[13px] text-muted-foreground">{whyNotTexted.explanation}</p>
          ) : null}
          {status === "FAILED" ? (
            <p className="text-[13px] text-rose-700">
              Failed — check messaging sender readiness in Setup.
            </p>
          ) : null}
        </dl>
      </MctbSectionPanel>

      {voicemail ? (
        <MctbSectionPanel
          title="Voicemail"
          action={
            <Link
              href={`${MCTB_ROUTES.voicemail}?id=${voicemail.id}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Open voicemail
            </Link>
          }
        >
          <p className="text-sm text-muted-foreground">
            Left {fmtDateTime(voicemail.createdAt)}
            {voicemail.durationSeconds ? ` · ${voicemail.durationSeconds}s` : ""}
          </p>
          {voicemail.aiSummary ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                AI summary
              </p>
              <p className="mt-1 text-sm">{voicemail.aiSummary}</p>
            </div>
          ) : null}
          {voicemail.transcriptText ? (
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Transcript
              </p>
              <p className="mt-1 text-sm">{voicemail.transcriptText}</p>
            </div>
          ) : voicemail.transcriptStatus ? (
            <p className="text-sm text-muted-foreground">
              Transcript {voicemail.transcriptStatus.replace(/_/g, " ")}
            </p>
          ) : null}
        </MctbSectionPanel>
      ) : null}

      {automation?.followUpStatus === "needs_follow_up" || automation?.state === "callback_requested" ? (
        <MctbSectionPanel title="Callback">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void followUp("called_back")}>
              Mark called back
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void followUp("resolved")}>
              Resolve
            </Button>
          </div>
        </MctbSectionPanel>
      ) : null}

      <MctbSectionPanel title="Conversation">
        {conversation ? (
          <>
            <p className="text-sm text-muted-foreground">
              {conversation.lastMessage?.direction === "inbound"
                ? `Latest reply · ${fmtDateTime(conversation.lastMessage.createdAt)}`
                : `Last outbound · ${conversation.lastMessage ? fmtDateTime(conversation.lastMessage.createdAt) : "—"}`}
            </p>
            {conversation.lastMessage?.body ? (
              <p className="rounded-lg bg-muted/40 p-3 text-sm">{conversation.lastMessage.body}</p>
            ) : null}
            <Link
              href={`${MCTB_ROUTES.conversations}?conversation=${conversation.id}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Open conversation
            </Link>
            {bookingAction?.allowed && bookingAction.bookingUrl && conversation ? (
              <form
                className="mt-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await fetch("/api/contacts/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "send_booking_link",
                      phone: String(event.callerE164),
                      bookingUrl: bookingAction.bookingUrl,
                    }),
                  });
                }}
              >
                <Button type="submit" size="sm" variant="secondary">
                  Send booking link
                </Button>
              </form>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No reply yet.</p>
        )}
      </MctbSectionPanel>

      {showCallBack && event.callerE164 ? (
        <MctbSectionPanel title="Call customer">
          <BusinessCallBackButton
            destinationE164={String(event.callerE164)}
            contextType="missed_call"
            contextRefId={eventId}
          />
        </MctbSectionPanel>
      ) : null}

      {linkClicks.length ? (
        <MctbSectionPanel title="Link activity">
          <ul className="space-y-2 text-sm">
            {linkClicks.map((click) => (
              <li key={click.id} className="flex justify-between gap-3">
                <span className="truncate">{click.destinationUrl || "Tracked link"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDateTime(click.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </MctbSectionPanel>
      ) : null}

      {formSubmissions.length ? (
        <MctbSectionPanel title="Request form">
          <ul className="space-y-2 text-sm">
            {formSubmissions.map((sub) => (
              <li key={sub.id}>
                <p className="text-xs text-muted-foreground">{fmtDateTime(sub.submittedAt)}</p>
              </li>
            ))}
          </ul>
        </MctbSectionPanel>
      ) : null}

      <details className="ref-deco-section overflow-hidden">
        <summary className="ref-deco-section-head cursor-pointer text-sm font-semibold">Diagnostics</summary>
        <div className="ref-deco-section-body space-y-2 text-xs text-muted-foreground">
          <p>Event ID: {eventId}</p>
          {event.traceId ? <p>Trace: {String(event.traceId)}</p> : null}
          {event.suppressionReason ? (
            <p>Suppression code: {String(event.suppressionReason)}</p>
          ) : null}
          {messagingContext ? <p>Sender: {messagingContext.senderLabel}</p> : null}
          {conversation ? <p>Conversation ID: {conversation.id}</p> : null}
          <p className="font-medium text-foreground">Authoritative timeline</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            {(timeline?.steps || []).map((step) => (
              <li key={`${step.id}-${step.at || "pending"}`}>
                {step.label} — {step.status}
                {step.at ? ` · ${fmtDateTime(step.at)}` : ""}
              </li>
            ))}
          </ol>
        </div>
      </details>
      </div>
      </div>
    </div>
  );
}
