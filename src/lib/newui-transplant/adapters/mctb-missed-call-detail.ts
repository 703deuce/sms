import { formatSuppressionReasonLabel } from "@/lib/mctb/analytics-suppression-labels";
import { classificationToTriggerLabel } from "@/lib/mctb/missed-calls-list-filters";
import { formatConsentModeLabel, formatRecoveryStatus, formatReplyStatus } from "@/lib/mctb/recovery-display";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import type { RecoveryStatus } from "@/newui-transplant/lib/view-models";

export type MctbMissedCallDetailWired = {
  id: string;
  caller: string;
  phone: string;
  phoneTel: string;
  line: string;
  missed: string;
  recovery: RecoveryStatus;
  trigger: string;
  reply: boolean;
  conversationId?: string;
  messages: Array<{ from: "customer" | "business"; text: string }>;
  lifecycleSteps: Array<{ label: string; detail: string; done: boolean }>;
  textBackRows: Array<{ label: string; value: string }>;
  linkActivity: string;
  requestForm: string;
  callDetailsRows: Array<{ label: string; value: string }>;
  consentRows: Array<{ label: string; value: string }>;
  showVoicemail: boolean;
  voicemailId?: string;
  voicemailRecordingSrc?: string;
  voicemailSummary?: string | null;
  voicemailTranscript?: string | null;
  senderLabel?: string;
  diagnostics: string;
};

function toRecoveryStatus(status: string, suppressionReason: string | null): RecoveryStatus {
  const label = formatRecoveryStatus(status, suppressionReason);
  const allowed: RecoveryStatus[] = [
    "Waiting for consent",
    "Sent",
    "Delivered",
    "Replied",
    "Needs attention",
    "Suppressed",
    "Failed",
  ];
  if (allowed.includes(label as RecoveryStatus)) return label as RecoveryStatus;
  if (label === "Opted out") return "Suppressed";
  return "Sent";
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function buildMctbMissedCallDetailWired(
  json: Record<string, unknown>,
  extras?: { senderLabel?: string },
): MctbMissedCallDetailWired | null {
  const event = json.event as Record<string, unknown> | undefined;
  if (!event) return null;

  const timeline = json.timeline as {
    consentMode?: string;
    traceId?: string | null;
    steps?: Array<{ label: string; status: string; at?: string | null }>;
  } | undefined;
  const conversation = json.conversation as {
    id: string;
    messages?: Array<{ body: string; direction: string }>;
  } | null;
  const consent = json.consent as {
    consentedAt?: string;
    consentMethod?: string;
    consentMode?: string | null;
    consentScope?: string;
  } | null;
  const contact = json.contact as { firstName?: string | null; lastName?: string | null } | null;
  const linkClicks = (json.linkClicks as Array<{ destinationUrl: string | null; createdAt?: string }>) ?? [];
  const formSubmissions = (json.formSubmissions as Array<{ submittedAt?: string }>) ?? [];
  const voicemail = json.voicemail as {
    id: string;
    transcriptText?: string | null;
    aiSummary?: string | null;
    transcriptStatus?: string | null;
  } | null;
  const repeatCaller = json.repeatCaller as { total: number; missedToday: number } | null;

  const callerE164 = String(event.callerE164 || "");
  const phone = formatMctbPhoneLabel(callerE164);
  const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim();
  const caller = name || phone;
  const detectedAt = String(event.detectedAt || "");
  const missed = fmtWhen(detectedAt);

  const status = String(event.status || "");
  const suppressionReason = (event.suppressionReason as string | null) ?? null;
  const recovery = toRecoveryStatus(status, suppressionReason);
  const trigger = classificationToTriggerLabel(
    String(event.classification || event.trigger || event.disposition || "NO_ANSWER"),
  );
  const reply = formatReplyStatus(status) === "Replied";

  const stepsFromApi = timeline?.steps ?? [];
  const lifecycleSteps =
    stepsFromApi.length > 0
      ? stepsFromApi.map((s) => ({
          label: s.label,
          detail: s.at ? fmtWhen(s.at) : s.status,
          done: s.status === "complete",
        }))
      : [
          { label: "Call missed", detail: `${trigger} · ${missed}`, done: true },
          {
            label: "Consent",
            detail: recovery === "Waiting for consent" ? "Waiting for caller to press 1" : "Captured",
            done: recovery !== "Waiting for consent",
          },
          {
            label: "Recovery text",
            detail:
              recovery === "Suppressed"
                ? suppressionReason
                  ? formatSuppressionReasonLabel(suppressionReason)
                  : "Not sent"
                : recovery === "Failed"
                  ? "Failed to deliver"
                  : recovery === "Waiting for consent"
                    ? "Waiting"
                    : "Sent",
            done: recovery !== "Suppressed" && recovery !== "Waiting for consent" && recovery !== "Failed",
          },
          { label: "Reply", detail: reply ? "Customer replied" : "No reply yet", done: reply },
        ];

  const messages =
    conversation?.messages?.map((m) => {
      const dir = String(m.direction || "").toLowerCase();
      const outbound = dir === "outbound" || dir === "out";
      return {
        from: outbound ? ("business" as const) : ("customer" as const),
        text: m.body,
      };
    }) ?? [];

  const linkActivity =
    linkClicks.length > 0
      ? `Booking link sent · ${linkClicks.length} click${linkClicks.length === 1 ? "" : "s"}`
      : status === "SENT" || status === "CUSTOMER_REPLIED"
        ? "Booking link sent · not clicked yet"
        : "No links sent.";

  const requestForm =
    formSubmissions.length > 0
      ? `Request form submitted${formSubmissions[0]?.submittedAt ? ` · ${fmtWhen(formSubmissions[0].submittedAt)}` : ""}.`
      : "No request form submitted.";

  const consentModeRaw = timeline?.consentMode ?? consent?.consentMode ?? "press_1";
  const consentModeLabel = formatConsentModeLabel(String(consentModeRaw));

  const repeatLabel =
    repeatCaller && (repeatCaller.missedToday > 1 || repeatCaller.total > 0)
      ? repeatCaller.missedToday > 1
        ? `${repeatCaller.missedToday} missed calls today`
        : `${repeatCaller.total} prior missed call(s)`
      : null;

  const textBackRows: Array<{ label: string; value: string }> = [
    { label: "Delivery", value: formatRecoveryStatus(status, suppressionReason) },
    { label: "Consent", value: consentModeLabel },
  ];
  if (suppressionReason) {
    textBackRows.push({
      label: "Suppression reason",
      value: formatSuppressionReasonLabel(suppressionReason),
    });
  }
  const scheduledAt = event.scheduledSmsAt as string | undefined;
  const sentAt = event.smsSentAt as string | undefined;
  if (scheduledAt) textBackRows.push({ label: "Scheduled", value: fmtWhen(scheduledAt) });
  if (sentAt) textBackRows.push({ label: "Sent", value: fmtWhen(sentAt) });

  const consentRows: Array<{ label: string; value: string }> = [
    { label: "Mode", value: consentModeLabel },
    {
      label: "Status",
      value: recovery === "Waiting for consent" ? "Pending" : consent ? "Captured" : "Granted",
    },
  ];
  if (consent?.consentedAt) {
    consentRows.push({ label: "Captured", value: fmtWhen(consent.consentedAt) });
  }
  if (consent?.consentScope) {
    consentRows.push({ label: "Scope", value: consent.consentScope });
  }

  const callDetailsRows: Array<{ label: string; value: string }> = [
    { label: "Trigger", value: trigger },
    {
      label: "Business line",
      value: formatMctbPhoneLabel(String(event.businessE164 || event.businessLineE164 || "—")),
    },
    { label: "Missed", value: missed },
  ];
  if (repeatLabel) callDetailsRows.push({ label: "Repeat caller", value: repeatLabel });

  const traceId = timeline?.traceId ? String(timeline.traceId) : "";
  const diagnosticsLines = [
    `event_id: ${event.id}`,
    `status: ${status}`,
    suppressionReason ? `suppression: ${suppressionReason}` : null,
    traceId ? `trace_id: ${traceId}` : null,
    consent ? "consent: loaded" : "consent: none",
  ].filter(Boolean);

  return {
    id: String(event.id),
    caller,
    phone,
    phoneTel: callerE164,
    line: formatMctbPhoneLabel(
      String(event.businessE164 || event.businessLineE164 || event.toE164 || ""),
    ),
    missed,
    recovery,
    trigger,
    reply,
    conversationId: conversation?.id,
    messages,
    lifecycleSteps,
    textBackRows,
    linkActivity,
    requestForm,
    callDetailsRows,
    consentRows,
    showVoicemail: Boolean(voicemail?.id),
    voicemailId: voicemail?.id,
    voicemailRecordingSrc: voicemail?.id ? `/api/phone/voicemail/${voicemail.id}/recording` : undefined,
    voicemailSummary: voicemail?.aiSummary ?? null,
    voicemailTranscript: voicemail?.transcriptText ?? null,
    senderLabel: extras?.senderLabel,
    diagnostics: diagnosticsLines.join("\n"),
  };
}
