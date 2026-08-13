import type { CallOutcomeBadge } from "./display";
import { deriveCallOutcomeBadge } from "./display";

export type StructuredMessage = {
  callerName?: string;
  phone?: string;
  email?: string;
  reason?: string;
  urgency?: string;
  preferredCallback?: string;
  notes?: string;
  serviceAddress?: string;
  location?: string;
};

export type CapturedField = { label: string; value: string };

export type ActionItem = {
  id: string;
  label: string;
  status: "done" | "skipped" | "failed";
  detail?: string;
};

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function buildCapturedFields(input: {
  contactName?: string | null;
  contactEmail?: string | null;
  fromE164?: string;
  structuredMessage?: unknown;
  insightCustomFields?: Record<string, unknown> | null;
  insightSummary?: string | null;
}): CapturedField[] {
  const sm = asRecord(input.structuredMessage) as StructuredMessage;
  const custom = input.insightCustomFields || {};
  const dash = "—";

  const name =
    input.contactName?.trim() ||
    String(sm.callerName || "").trim() ||
    dash;
  const phone =
    String(sm.phone || "").trim() ||
    (input.fromE164 ? input.fromE164 : dash);
  const email =
    input.contactEmail?.trim() ||
    String(sm.email || "").trim() ||
    dash;
  const serviceAddress =
    String(sm.serviceAddress || sm.location || custom.service_address || custom.location || "").trim() ||
    dash;
  const reason =
    String(sm.reason || custom.reason || custom.issue || "").trim() ||
    (input.insightSummary ? input.insightSummary.split(".")[0] : dash);

  return [
    { label: "Name", value: name },
    { label: "Phone", value: phone },
    { label: "Email", value: email },
    { label: "Service Address", value: serviceAddress },
    { label: "Reason for calling", value: reason },
  ];
}

export function buildActionItems(input: {
  call: {
    appointmentBooked?: boolean;
    transferred?: boolean;
    outcome?: string | null;
    endedAt?: string | null;
  };
  structuredMessage?: unknown;
  toolExecutions?: Array<{
    toolType?: string | null;
    status?: string | null;
    createdAt?: string;
    error?: string | null;
  }>;
  transfers?: Array<{
    status?: string | null;
    destination?: string | null;
    createdAt?: string;
    summary?: string | null;
  }>;
}): ActionItem[] {
  const sm = asRecord(input.structuredMessage) as StructuredMessage;
  const items: ActionItem[] = [];
  const fmtTime = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : undefined;

  const messageTool = input.toolExecutions?.find((t) =>
    String(t.toolType || "").includes("message"),
  );
  const messageTaken =
    Boolean(sm.reason) ||
    String(input.call.outcome || "").includes("message") ||
    Boolean(messageTool);

  if (messageTaken) {
    items.push({
      id: "message",
      label: "Message taken",
      status: "done",
      detail: sm.preferredCallback
        ? `Callback ${sm.preferredCallback}`
        : fmtTime(messageTool?.createdAt || input.call.endedAt),
    });
  } else {
    items.push({ id: "message", label: "No message taken", status: "skipped" });
  }

  const hasInfo =
    Boolean(sm.callerName || sm.phone || sm.email || sm.reason || sm.serviceAddress);
  items.push({
    id: "info",
    label: "Caller information collected",
    status: hasInfo ? "done" : "skipped",
  });

  const bookingTool = input.toolExecutions?.find((t) =>
    String(t.toolType || "").includes("book"),
  );
  if (input.call.appointmentBooked || bookingTool) {
    items.push({
      id: "booking",
      label: "Appointment booked",
      status: bookingTool?.error ? "failed" : "done",
      detail: bookingTool?.error
        ? String(bookingTool.error)
        : fmtTime(bookingTool?.createdAt || input.call.endedAt),
    });
  } else {
    items.push({ id: "booking", label: "No appointment booked", status: "skipped" });
  }

  const transfer = input.transfers?.[0];
  const transferTool = input.toolExecutions?.find((t) =>
    String(t.toolType || "").includes("transfer"),
  );
  if (input.call.transferred || transfer || transferTool) {
    const failed =
      transfer?.status === "failed" ||
      transferTool?.status === "failed" ||
      Boolean(transferTool?.error);
    items.push({
      id: "transfer",
      label: failed ? "Transfer unsuccessful" : "Transferred",
      status: failed ? "failed" : "done",
      detail:
        transferTool?.error ||
        transfer?.summary ||
        (transfer?.destination ? `To ${transfer.destination}` : undefined) ||
        fmtTime(transfer?.createdAt),
    });
  } else {
    items.push({ id: "transfer", label: "No transfer attempted", status: "skipped" });
  }

  return items;
}

export function deriveOutcomeBadges(call: {
  outcome?: string | null;
  appointmentBooked?: boolean;
  transferred?: boolean;
  voicemailDetected?: boolean;
  isLead?: boolean | null;
  leadScore?: number | null;
  status?: string;
}): CallOutcomeBadge[] {
  const primary = deriveCallOutcomeBadge(call);
  const badges: CallOutcomeBadge[] = [primary];
  if (primary === "New Lead" && call.outcome?.toLowerCase().includes("message")) {
    badges.push("Message Taken");
  }
  return badges;
}

export function fmtSentimentLabel(sentiment?: string | null): string {
  if (!sentiment) return "—";
  const s = sentiment.toLowerCase();
  if (s.includes("positive")) return "Positive";
  if (s.includes("negative")) return "Negative";
  return "Neutral";
}

export function fmtUrgency(input: {
  structuredMessage?: unknown;
  insightCustomFields?: Record<string, unknown> | null;
}): string {
  const sm = asRecord(input.structuredMessage) as StructuredMessage;
  const custom = input.insightCustomFields || {};
  const raw = String(sm.urgency || custom.urgency || "normal").toLowerCase();
  if (raw.includes("high") || raw.includes("urgent")) return "High";
  if (raw.includes("low")) return "Low";
  return "Normal";
}
