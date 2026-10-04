import { getPrisma } from "@/lib/db";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";
import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";
import { createMctbLeadSnapshot } from "./snapshot";
import type { MctbHandoffEventType, MctbLeadSnapshotFacts } from "./types";
import type { MctbTeamActivityBrief, MctbTeamBriefContext } from "./team-activity-brief-types";

const SYSTEM = `You write concise missed-call recovery briefs for a small business owner.
Use only facts from the input. Do not invent appointments, prices, or promises.
Return JSON only:
{
  "headline": "string (<=120 chars, who called and why it matters)",
  "summary": "string (2-4 short sentences, plain language)",
  "bullets": ["string", ...] (3-6 factual bullets: call outcome, voicemail, each key SMS point, urgency),
  "recommendedNextStep": "string (one clear action for the team)"
}
If there was no voicemail and no SMS replies yet, say recovery text was sent and caller has not replied yet.`;

export async function loadTeamBriefContext(input: {
  workspaceId: string;
  missedCallEventId?: string | null;
  conversationId?: string | null;
  triggerEvent: MctbHandoffEventType;
}): Promise<MctbTeamBriefContext | null> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });

  let missed:
    | {
        callerE164: string;
        detectedAt: Date;
        status: string;
        contactId: string | null;
      }
    | null = null;
  if (input.missedCallEventId) {
    missed = await prisma.missedCallEvent.findFirst({
      where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
      select: {
        callerE164: true,
        detectedAt: true,
        status: true,
        contactId: true,
      },
    });
  }

  const callerPhone = missed?.callerE164 || "";
  let callerName: string | undefined;
  if (missed?.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: missed.contactId, workspaceId: input.workspaceId },
      select: { firstName: true, lastName: true },
    });
    const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim();
    if (name) callerName = name;
  }

  const productSource = appProductSourceToPrisma("mctb");
  const smsThread: MctbTeamBriefContext["smsThread"] = [];

  if (input.conversationId) {
    const messages = await prisma.conversationMessage.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: { body: true, direction: true, createdAt: true },
    });
    for (const m of messages) {
      const dir = String(m.direction || "").toLowerCase();
      const direction =
        dir === "inbound" || dir === "in"
          ? "customer"
          : dir === "outbound" || dir === "out"
            ? "business"
            : "system";
      smsThread.push({
        direction,
        body: m.body,
        at: m.createdAt.toISOString(),
      });
    }
  }

  let voicemailTranscript: string | null = null;
  let voicemailSummary: string | null = null;
  if (missed) {
    const vm = await prisma.voicemailMessage.findFirst({
      where: {
        workspaceId: input.workspaceId,
        fromE164: missed.callerE164,
        createdAt: {
          gte: new Date(missed.detectedAt.getTime() - 10 * 60 * 1000),
          lte: new Date(missed.detectedAt.getTime() + 2 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
      select: { transcriptText: true, aiSummary: true },
    });
    voicemailTranscript = vm?.transcriptText ?? null;
    voicemailSummary = vm?.aiSummary ?? null;
  }

  if (!callerPhone && smsThread.length === 0 && !voicemailTranscript) {
    return null;
  }

  return {
    businessName: workspace?.name || "Business",
    missedAt: missed?.detectedAt?.toISOString() ?? null,
    callerPhone,
    callerName,
    recoveryStatus: missed?.status,
    voicemailTranscript,
    voicemailSummary,
    smsThread,
    triggerEvent: input.triggerEvent,
  };
}

function fallbackBrief(ctx: MctbTeamBriefContext): MctbTeamActivityBrief {
  const customerSms = ctx.smsThread.filter((m) => m.direction === "customer");
  const headline = ctx.callerName
    ? `Missed call from ${ctx.callerName}`
    : `Missed call from ${ctx.callerPhone || "unknown caller"}`;

  const parts: string[] = [];
  if (ctx.voicemailTranscript?.trim()) {
    parts.push(`Voicemail: ${ctx.voicemailTranscript.trim().slice(0, 400)}`);
  } else if (ctx.voicemailSummary?.trim()) {
    parts.push(`Voicemail summary: ${ctx.voicemailSummary.trim()}`);
  }
  if (customerSms.length) {
    parts.push(
      `Customer texted ${customerSms.length} time(s). Latest: "${customerSms[customerSms.length - 1]!.body.slice(0, 200)}"`,
    );
  } else {
    parts.push("No SMS reply from the customer yet.");
  }

  return {
    headline,
    summary: parts.join(" "),
    bullets: parts,
    recommendedNextStep: customerSms.length
      ? "Review the thread and call or text the customer back."
      : "Wait for a reply or call the customer back if urgent.",
    hasVoicemail: Boolean(ctx.voicemailTranscript?.trim() || ctx.voicemailSummary?.trim()),
    hasTextReplies: customerSms.length > 0,
    textReplyCount: customerSms.length,
    callerName: ctx.callerName,
    callerPhone: ctx.callerPhone,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateTeamActivityBrief(
  ctx: MctbTeamBriefContext,
): Promise<MctbTeamActivityBrief> {
  const customerSms = ctx.smsThread.filter((m) => m.direction === "customer");
  const payload = {
    business: ctx.businessName,
    trigger: ctx.triggerEvent,
    missed_at: ctx.missedAt,
    caller: { name: ctx.callerName ?? null, phone: ctx.callerPhone },
    recovery_status: ctx.recoveryStatus ?? null,
    voicemail: {
      transcript: ctx.voicemailTranscript?.slice(0, 4000) ?? null,
      summary: ctx.voicemailSummary?.slice(0, 2000) ?? null,
    },
    sms_thread: ctx.smsThread.slice(-30).map((m) => ({
      from: m.direction,
      text: m.body.slice(0, 2000),
      at: m.at ?? null,
    })),
  };

  try {
    const result = await mctbSemanticStructuredJson<{
      headline?: string;
      summary?: string;
      bullets?: string[];
      recommendedNextStep?: string;
    }>({
      system: SYSTEM,
      user: JSON.stringify(payload),
      temperature: 0.2,
      maxTokens: 900,
    });

    if (result?.data?.headline && result.data.summary) {
      return {
        headline: result.data.headline.trim().slice(0, 160),
        summary: result.data.summary.trim(),
        bullets: Array.isArray(result.data.bullets)
          ? result.data.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 8)
          : [],
        recommendedNextStep:
          typeof result.data.recommendedNextStep === "string" &&
          result.data.recommendedNextStep.trim()
            ? result.data.recommendedNextStep.trim()
            : "Follow up with the caller.",
        hasVoicemail: Boolean(ctx.voicemailTranscript?.trim() || ctx.voicemailSummary?.trim()),
        hasTextReplies: customerSms.length > 0,
        textReplyCount: customerSms.length,
        callerName: ctx.callerName,
        callerPhone: ctx.callerPhone,
        generatedAt: new Date().toISOString(),
        provider: result.provider,
        model: result.model,
      };
    }
  } catch {
    /* use fallback */
  }

  return fallbackBrief(ctx);
}

export async function ensureTeamActivityBriefForHandoff(input: {
  workspaceId: string;
  handoffEventId: string;
  missedCallEventId?: string | null;
  conversationId?: string | null;
  eventType: MctbHandoffEventType;
  facts: MctbLeadSnapshotFacts;
}): Promise<MctbTeamActivityBrief | null> {
  const ctx = await loadTeamBriefContext({
    workspaceId: input.workspaceId,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    triggerEvent: input.eventType,
  });
  if (!ctx) return null;

  const brief = await generateTeamActivityBrief(ctx);
  const prisma = getPrisma();

  const snapshot = await createMctbLeadSnapshot({
    workspaceId: input.workspaceId,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    triggerEvent: input.eventType,
    customerFacts: input.facts,
    aiDerived: { teamBrief: brief },
  });

  await prisma.mctbHandoffEvent
    .update({
      where: { id: input.handoffEventId },
      data: { leadSnapshotId: snapshot.id },
    })
    .catch(() => undefined);

  return brief;
}

export async function loadLatestTeamBriefForMissedCall(
  workspaceId: string,
  missedCallEventId: string,
): Promise<MctbTeamActivityBrief | null> {
  const prisma = getPrisma();
  const row = await prisma.mctbLeadSnapshot.findFirst({
    where: { workspaceId, missedCallEventId },
    orderBy: { createdAt: "desc" },
    select: { aiDerivedJson: true },
  });
  const derived = row?.aiDerivedJson as { teamBrief?: MctbTeamActivityBrief } | null;
  return derived?.teamBrief ?? null;
}

export async function loadLatestTeamBriefsForMissedCalls(
  workspaceId: string,
  missedCallEventIds: string[],
): Promise<Map<string, MctbTeamActivityBrief>> {
  const out = new Map<string, MctbTeamActivityBrief>();
  if (!missedCallEventIds.length) return out;
  const prisma = getPrisma();
  const rows = await prisma.mctbLeadSnapshot.findMany({
    where: { workspaceId, missedCallEventId: { in: missedCallEventIds } },
    orderBy: { createdAt: "desc" },
    select: { missedCallEventId: true, aiDerivedJson: true },
  });
  for (const row of rows) {
    if (!row.missedCallEventId || out.has(row.missedCallEventId)) continue;
    const derived = row.aiDerivedJson as { teamBrief?: MctbTeamActivityBrief } | null;
    if (derived?.teamBrief) out.set(row.missedCallEventId, derived.teamBrief);
  }
  return out;
}
