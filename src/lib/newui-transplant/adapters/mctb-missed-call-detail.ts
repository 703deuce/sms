import { classificationToTriggerLabel } from "@/lib/mctb/missed-calls-list-filters";
import { formatRecoveryStatus, formatReplyStatus } from "@/lib/mctb/recovery-display";
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

export function buildMctbMissedCallDetailWired(
  json: Record<string, unknown>,
  extras?: { senderLabel?: string },
): MctbMissedCallDetailWired | null {
  const event = json.event as Record<string, unknown> | undefined;
  if (!event) return null;

  const timeline = json.timeline as { consentMode?: string; steps?: Array<{ label: string; status: string; at?: string | null }> } | undefined;
  const conversation = json.conversation as {
    id: string;
    messages?: Array<{ body: string; direction: string }>;
  } | null;
  const consent = json.consent as Record<string, unknown> | null;
  const contact = json.contact as { firstName?: string | null; lastName?: string | null } | null;
  const linkClicks = (json.linkClicks as Array<{ destinationUrl: string | null }>) ?? [];
  const formSubmissions = (json.formSubmissions as Array<unknown>) ?? [];
  const voicemail = json.voicemail as { id: string } | null;

  const callerE164 = String(event.callerE164 || "");
  const phone = formatMctbPhoneLabel(callerE164);
  const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim();
  const caller = name || phone;
  const detectedAt = String(event.detectedAt || "");
  const missed = detectedAt
    ? new Date(detectedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

  const status = String(event.status || "");
  const suppressionReason = (event.suppressionReason as string | null) ?? null;
  const recovery = toRecoveryStatus(status, suppressionReason);
  const trigger = classificationToTriggerLabel(String(event.classification || event.trigger || "NO_ANSWER"));
  const reply = formatReplyStatus(status) === "Replied";

  const stepsFromApi = timeline?.steps ?? [];
  const lifecycleSteps =
    stepsFromApi.length > 0
      ? stepsFromApi.map((s) => ({
          label: s.label,
          detail: s.at ? new Date(s.at).toLocaleString() : s.status,
          done: s.status === "complete",
        }))
      : [
          { label: "Call missed", detail: `${trigger} · ${missed}`, done: true },
          { label: "Consent", detail: recovery === "Waiting for consent" ? "Waiting for caller to press 1" : "Captured", done: recovery !== "Waiting for consent" },
          { label: "Recovery text", detail: recovery === "Suppressed" ? "Not sent" : "Delivered", done: recovery !== "Suppressed" && recovery !== "Waiting for consent" },
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
    formSubmissions.length > 0 ? "Request form submitted." : "No request form submitted.";

  const consentMode = timeline?.consentMode === "existing_consent" ? "Existing permission" : "Press 1";

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
    textBackRows: [
      { label: "Delivery", value: formatRecoveryStatus(status, suppressionReason) },
      { label: "Consent", value: consentMode },
    ],
    linkActivity,
    requestForm,
    callDetailsRows: [
      { label: "Trigger", value: trigger },
      {
        label: "Business line",
        value: formatMctbPhoneLabel(String(event.businessE164 || event.businessLineE164 || "—")),
      },
    ],
    consentRows: [
      { label: "Mode", value: consentMode },
      {
        label: "Status",
        value: recovery === "Waiting for consent" ? "Pending" : "Granted",
      },
    ],
    showVoicemail: Boolean(voicemail?.id),
    voicemailId: voicemail?.id,
    voicemailRecordingSrc: voicemail?.id ? `/api/phone/voicemail/${voicemail.id}/recording` : undefined,
    senderLabel: extras?.senderLabel,
    diagnostics: `event_id: ${event.id}\nstatus: ${status}\nconsent: ${consent ? "loaded" : "none"}`,
  };
}
