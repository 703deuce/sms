"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_LABELS,
  MCTB_CONSENT_MODE_VERIFIED,
} from "@/lib/mctb/consent-mode";
import { classificationToTriggerLabel } from "@/lib/mctb/missed-calls-list-filters";
import { formatRecoveryStatus, formatReplyStatus } from "@/lib/mctb/recovery-display";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const recovery = formatRecoveryStatus(status, suppressionReason);
  if (status === "CUSTOMER_REPLIED") return "Needs reply";
  if (status === "SUPPRESSED") return "Suppressed";
  if (status === "FAILED") return "Failed";
  if (recovery === "Waiting for consent") return "Waiting for consent";
  if (status === "SENT" || status === "CUSTOMER_REPLIED") return "Recovered";
  return recovery;
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

  const lifecycleSteps = useMemo(() => {
    const detectedAt = event?.detectedAt ? String(event.detectedAt) : null;
    const status = String(event?.status || "");
    const suppressionReason =
      event?.suppressionReason != null ? String(event.suppressionReason) : null;

    const steps: Array<{ label: string; value: string; detail?: string }> = [
      {
        label: "Call",
        value: detectedAt ? `Missed · ${fmtDateTime(detectedAt)}` : "Missed",
      },
    ];

    if (isPress1) {
      steps.push({
        label: "Consent",
        value: consent
          ? `Captured by ${MCTB_CONSENT_MODE_LABELS.press_1.title}`
          : suppressionReason === "NOT_EXISTING_CONSENT"
            ? "Not captured"
            : "Pending",
        detail: consent?.consentedAt
          ? fmtDateTime(String(consent.consentedAt))
          : undefined,
      });
      steps.push({
        label: "Compliance text",
        value: event?.smsSentAt ? `Sent · ${fmtDateTime(String(event.smsSentAt))}` : "—",
      });
    } else if (isExistingConsent) {
      steps.push({
        label: "Consent",
        value: "Existing permission mode",
        detail: "No Press-1 prompt on this call",
      });
    }

    steps.push({
      label: "Recovery text",
      value: formatRecoveryStatus(status, suppressionReason),
      detail: event?.smsSentAt ? fmtDateTime(String(event.smsSentAt)) : undefined,
    });

    steps.push({
      label: "Reply",
      value: formatReplyStatus(status),
    });

    return steps;
  }, [consent, event, isExistingConsent, isPress1]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading missed call">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="h-32 rounded-xl border border-border bg-card" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <p className="text-sm text-rose-600">{error || "Missed call not found."}</p>
        <Link href={backHref} className="mt-4 inline-block text-sm font-semibold text-primary">
          ← Missed Calls
        </Link>
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link href={backHref} className="text-sm font-semibold text-primary hover:underline">
          ← Missed Calls
        </Link>
        <PageHeader
          title={callerLabel}
          description={`Missed call · ${event.detectedAt ? fmtDateTime(String(event.detectedAt)) : "—"} · Called ${fmtPhone(String(event.businessE164 || ""))}`}
          actions={primaryAction}
        />
        <p className="text-sm font-medium text-foreground">
          {primaryStatusLabel(status, suppressionReason)}
        </p>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Recovery lifecycle</h2>
        <ol className="mt-3 space-y-2">
          {lifecycleSteps.map((step) => (
            <li key={step.label} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">{step.label}</span>
              <span className="text-muted-foreground">
                {step.value}
                {step.detail ? ` · ${step.detail}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Call details</h2>
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
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Consent</h2>
          <Link href={MCTB_ROUTES.complianceConsent} className="text-sm font-semibold text-primary hover:underline">
            View consent record
          </Link>
        </div>
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
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Text-back</h2>
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
          {suppressionReason ? (
            <p className="text-[13px] text-muted-foreground">
              {suppressionReason === "OPTED_OUT"
                ? "Suppressed — customer opted out"
                : `Suppressed — ${suppressionReason.replace(/_/g, " ").toLowerCase()}`}
            </p>
          ) : null}
          {status === "FAILED" ? (
            <p className="text-[13px] text-rose-700">
              Failed — check messaging sender readiness in Setup.
            </p>
          ) : null}
        </dl>
      </Card>

      {voicemail ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Voicemail</h2>
            <Link
              href={`${MCTB_ROUTES.voicemail}?id=${voicemail.id}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Open voicemail
            </Link>
          </div>
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
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Conversation</h2>
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
              href={`/conversations?product=mctb&conversation=${conversation.id}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Open conversation
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No reply yet.</p>
        )}
      </Card>

      {showCallBack && event.callerE164 ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Call customer</h2>
          <BusinessCallBackButton
            destinationE164={String(event.callerE164)}
            contextType="missed_call"
            contextRefId={eventId}
          />
        </Card>
      ) : null}

      {linkClicks.length ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Link activity</h2>
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
        </Card>
      ) : null}

      {formSubmissions.length ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Request form</h2>
          <ul className="space-y-2 text-sm">
            {formSubmissions.map((sub) => (
              <li key={sub.id}>
                <p className="text-xs text-muted-foreground">{fmtDateTime(sub.submittedAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Diagnostics</summary>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <p>Event ID: {eventId}</p>
          {event.traceId ? <p>Trace: {String(event.traceId)}</p> : null}
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
  );
}
