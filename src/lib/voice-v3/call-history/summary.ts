import "server-only";

import { getPrisma } from "@/lib/db";

export type CallHistoryStructuredFacts = {
  callerName?: string | null;
  callerPhone?: string | null;
  appointmentBooked?: boolean;
  appointmentService?: string | null;
  appointmentStart?: string | null;
  callbackRequested?: boolean;
  callbackReason?: string | null;
  transferred?: boolean;
  transferDestination?: string | null;
  bookingLinkSent?: boolean;
  outcomeLabel?: string | null;
};

export async function loadDeterministicCallFacts(
  callId: string,
  workspaceId: string,
): Promise<CallHistoryStructuredFacts> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true } },
      appointments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          serviceName: true,
          startsAt: true,
          status: true,
          provider: true,
        },
      },
      transfers: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!call) return {};

  const callerName = call.contact
    ? [call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ")
    : null;
  const appt = call.appointments[0];
  const transfer = call.transfers[0];
  const outcome = String(call.outcome || "").toLowerCase();

  return {
    callerName,
    callerPhone: call.fromE164 || call.contact?.phone || null,
    appointmentBooked: call.appointmentBooked,
    appointmentService: appt?.serviceName ?? null,
    appointmentStart: appt?.startsAt?.toISOString() ?? null,
    callbackRequested: outcome.includes("callback"),
    transferred: call.transferred,
    transferDestination: transfer?.destination ?? null,
    bookingLinkSent: outcome.includes("booking_link"),
    outcomeLabel: call.outcome,
  };
}

function formatAppointmentLine(facts: CallHistoryStructuredFacts): string | null {
  if (!facts.appointmentBooked || !facts.appointmentStart) return null;
  const d = new Date(facts.appointmentStart);
  const when = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const svc = facts.appointmentService ? ` for ${facts.appointmentService}` : "";
  return `Appointment confirmed${svc} on ${when}.`;
}

export function buildDeterministicSummary(
  transcriptText: string,
  facts: CallHistoryStructuredFacts,
): string {
  const lines: string[] = [];
  const who = facts.callerName || facts.callerPhone || "The caller";
  const snippet = transcriptText.trim().slice(0, 280);

  if (facts.appointmentBooked) {
    const appt = formatAppointmentLine(facts);
    lines.push(
      appt ||
        `${who} completed a call and booked an appointment.`,
    );
    if (snippet) lines.push(snippet);
    return lines.slice(0, 3).join(" ");
  }

  if (facts.callbackRequested) {
    lines.push(
      `${who} requested a callback${facts.callbackReason ? ` regarding ${facts.callbackReason}` : ""}. No appointment was booked.`,
    );
    return lines.join(" ");
  }

  if (facts.transferred && facts.transferDestination) {
    lines.push(`${who} was transferred to ${facts.transferDestination}.`);
    return lines.join(" ");
  }

  if (facts.bookingLinkSent) {
    lines.push(`${who} received a booking link during the call.`);
    return lines.join(" ");
  }

  if (snippet) {
    return `${who} called. ${snippet}`;
  }
  return `${who} completed a call.`;
}

export async function ensureCallHistorySummary(input: {
  workspaceId: string;
  callId: string;
  transcriptText: string;
}): Promise<{ summary: string; usedLlm: boolean }> {
  const prisma = getPrisma();
  const existing = await prisma.voiceConversationInsight.findFirst({
    where: { callId: input.callId, workspaceId: input.workspaceId },
    select: { id: true, summary: true },
  });
  if (existing?.summary?.trim()) {
    return { summary: existing.summary.trim(), usedLlm: false };
  }

  const facts = await loadDeterministicCallFacts(input.callId, input.workspaceId);
  const baseline = buildDeterministicSummary(input.transcriptText, facts);

  let summary = baseline;
  let usedLlm = false;
  const text = input.transcriptText.trim();
  if (text.length > 80 && process.env.OPENAI_API_KEY?.trim()) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const factsBlock = JSON.stringify(facts, null, 2);
      const res = await client.chat.completions.create({
        model: process.env.VOICE_CALL_SUMMARY_MODEL?.trim() || "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Write a concise 2-4 sentence call summary for a business owner. Use only facts from the transcript and structured facts JSON. Do not invent appointments, names, or outcomes.",
          },
          {
            role: "user",
            content: `Structured facts (authoritative):\n${factsBlock}\n\nTranscript:\n${text.slice(0, 6000)}`,
          },
        ],
      });
      const llm = res.choices[0]?.message?.content?.trim();
      if (llm) {
        summary = llm;
        usedLlm = true;
      }
    } catch (err) {
      console.warn("VOICE_CALL_SUMMARY_LLM_FAILED", {
        callId: input.callId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await prisma.voiceConversationInsight.create({
    data: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      summary,
      intent: facts.appointmentBooked ? "appointment" : facts.callbackRequested ? "callback" : "general",
      sentiment: "neutral",
      isLead: false,
      confidence: usedLlm ? 0.85 : 0.7,
      customFields: facts as object,
    },
  });

  console.log("VOICE_CALL_SUMMARY_COMPLETED", {
    callId: input.callId,
    usedLlm,
  });

  return { summary, usedLlm };
}
