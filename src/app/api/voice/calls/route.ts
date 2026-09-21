import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { initiateOutboundCall } from "@/lib/voice/call-service";
import { projectCallListFields } from "@/lib/voice/calls/list-projection";

function rangeStart(dateRange: string): Date | null {
  const now = new Date();
  if (dateRange === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (dateRange === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (dateRange === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

function applyListFilter(where: Record<string, unknown>, filter: string): void {
  if (filter === "leads") {
    where.OR = [
      { leadScore: { gte: 40 } },
      { outcome: { contains: "lead", mode: "insensitive" } },
    ];
  } else if (filter === "messages") {
    where.OR = [
      { outcome: { contains: "message", mode: "insensitive" } },
      { outcome: { contains: "callback", mode: "insensitive" } },
      { outcome: { contains: "follow_up", mode: "insensitive" } },
    ];
  } else if (filter === "appointments" || filter === "booked") {
    where.appointmentBooked = true;
  } else if (filter === "transferred") {
    where.transferred = true;
  } else if (filter === "emergencies") {
    where.OR = [
      { outcome: { contains: "emergency", mode: "insensitive" } },
      { metadata: { path: ["voiceV3Analytics", "outcome"], equals: "EMERGENCY_ESCALATED" } },
    ];
  } else if (filter === "attention") {
    where.metadata = { path: ["voiceV3Analytics", "actionRequired"], equals: true };
  } else if (filter === "spam") {
    where.OR = [
      { outcome: { contains: "spam", mode: "insensitive" } },
      { outcome: { contains: "solicit", mode: "insensitive" } },
      { metadata: { path: ["voiceV3Analytics", "outcome"], equals: "SPAM" } },
      { metadata: { path: ["voiceV3Analytics", "outcome"], equals: "SOLICITOR" } },
    ];
  } else if (filter === "no_action") {
    where.AND = [
      { appointmentBooked: false },
      { transferred: false },
      { OR: [{ outcome: null }, { outcome: "" }, { outcome: "no_action" }] },
    ];
  }
}

async function periodMetrics(
  prisma: ReturnType<typeof getPrisma>,
  workspaceId: string,
  isTest: boolean,
  from: Date,
  to?: Date,
) {
  const where = {
    workspaceId,
    isTest,
    startedAt: to ? { gte: from, lt: to } : { gte: from },
  };
  const [answered, leads, appointments, durationAgg] = await Promise.all([
    prisma.voiceCall.count({ where: { ...where, answeredAt: { not: null } } }),
    prisma.voiceCall.count({ where: { ...where, leadScore: { gte: 40 } } }),
    prisma.voiceCall.count({ where: { ...where, appointmentBooked: true } }),
    typeof prisma.voiceCall.aggregate === "function"
      ? prisma.voiceCall.aggregate({
          where: { ...where, durationSeconds: { not: null } },
          _sum: { durationSeconds: true },
        })
      : Promise.resolve({ _sum: { durationSeconds: 0 } }),
  ]);
  return {
    answered,
    leads,
    appointments,
    talkTimeSeconds: durationAgg._sum.durationSeconds || 0,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const direction = url.searchParams.get("direction");
    const status = url.searchParams.get("status");
    const isTest = url.searchParams.get("test");
    const q = (url.searchParams.get("q") || "").trim();
    const filter = (url.searchParams.get("filter") || "all").toLowerCase();
    const dateRange = (url.searchParams.get("dateRange") || "7d").toLowerCase();

    const where: Record<string, unknown> = { workspaceId: auth.workspaceId };
    if (direction) where.direction = direction.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (isTest === "1") where.isTest = true;
    if (isTest === "0") where.isTest = false;

    const rangeFrom = rangeStart(dateRange);
    if (rangeFrom) {
      where.startedAt = { gte: rangeFrom };
    }

    applyListFilter(where, filter);

    if (q) {
      const searchOr = [
        { fromE164: { contains: q } },
        { toE164: { contains: q } },
        { outcome: { contains: q, mode: "insensitive" } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR as unknown[] }, { OR: searchOr }];
        delete where.OR;
      } else if (where.AND) {
        (where.AND as unknown[]).push({ OR: searchOr });
      } else {
        where.OR = searchOr;
      }
    }

    const prisma = getPrisma();
    const rows = await prisma.voiceCall.findMany({
      where: where as never,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        agent: { select: { id: true, name: true } },
        insights: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            summary: true,
            intent: true,
            sentiment: true,
            isLead: true,
            leadScore: true,
          },
        },
        recordings: { select: { id: true }, take: 1 },
        transcripts: { select: { id: true }, take: 1 },
      },
    });

    const contactIds = [
      ...new Set(
        rows
          .map((c: (typeof rows)[number]) => c.contactId)
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    ];
    type ContactNameRow = {
      id: string;
      firstName: string | null;
      lastName: string | null;
      phone: string;
    };
    const contacts: ContactNameRow[] = contactIds.length
      ? await prisma.contact.findMany({
          where: { workspaceId: auth.workspaceId, id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true, phone: true },
        })
      : [];
    const contactMap = new Map<string, ContactNameRow>(
      contacts.map((c) => [c.id, c]),
    );

    const isTestBool = isTest === "1";
    const periodDays = dateRange === "today" ? 1 : dateRange === "30d" ? 30 : 7;
    const currentStart = rangeStart(dateRange === "today" ? "today" : "7d")!;
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - periodDays);

    let metrics = {
      answered: 0,
      leads: 0,
      appointments: 0,
      talkTimeSeconds: 0,
      answeredChangePct: null as number | null,
      leadsChangePct: null as number | null,
      appointmentsChangePct: null as number | null,
      talkTimeChangePct: null as number | null,
    };

    try {
      const current = await periodMetrics(
        prisma,
        auth.workspaceId,
        isTestBool,
        currentStart,
      );
      const previous = await periodMetrics(
        prisma,
        auth.workspaceId,
        isTestBool,
        previousStart,
        currentStart,
      );
      const pct = (c: number, p: number) =>
        p === 0 ? (c > 0 ? 100 : null) : Math.round(((c - p) / p) * 100);

      metrics = {
        answered: current.answered,
        leads: current.leads,
        appointments: current.appointments,
        talkTimeSeconds: current.talkTimeSeconds,
        answeredChangePct: pct(current.answered, previous.answered),
        leadsChangePct: pct(current.leads, previous.leads),
        appointmentsChangePct: pct(current.appointments, previous.appointments),
        talkTimeChangePct: pct(current.talkTimeSeconds, previous.talkTimeSeconds),
      };
    } catch {
      // Analytics best-effort
    }

    return NextResponse.json({
      data: rows.map((c: (typeof rows)[number]) => {
        const insight = c.insights?.[0] || null;
        const contact = c.contactId ? contactMap.get(c.contactId) : null;
        const contactName = contact
          ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
          : null;
        const recordingId = c.recordings?.[0]?.id ?? null;
        const projected = projectCallListFields(c);
        const meta =
          c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata)
            ? (c.metadata as Record<string, unknown>)
            : {};
        const postCall = meta.voiceV3PostCall as Record<string, unknown> | undefined;
        return {
          id: c.id,
          direction: c.direction,
          status: c.status,
          outcome: c.outcome,
          fromE164: c.fromE164,
          toE164: c.toE164,
          agentId: c.agentId,
          agentName: c.agent?.name || null,
          campaignId: c.campaignId,
          contactId: c.contactId,
          contactName: contactName || null,
          durationSeconds: c.durationSeconds,
          leadScore: c.leadScore ?? insight?.leadScore ?? null,
          appointmentBooked: c.appointmentBooked,
          transferred: c.transferred,
          voicemailDetected: c.voicemailDetected,
          costCents: c.costCents,
          isTest: c.isTest,
          startedAt: c.startedAt.toISOString(),
          endedAt: c.endedAt?.toISOString() ?? null,
          summary: insight?.summary || null,
          intent: insight?.intent || null,
          sentiment: insight?.sentiment || null,
          isLead: insight?.isLead ?? (c.leadScore != null && c.leadScore >= 40),
          hasRecording: Boolean(recordingId),
          recordingId,
          hasTranscript: (c.transcripts?.length || 0) > 0,
          reasonForCall: projected.reasonForCall,
          needsAttention: projected.needsAttention,
          v3Outcome: projected.v3Outcome,
          spamLikely: projected.spamLikely,
          solicitor: projected.solicitor,
          postCallStatus: postCall?.pipelineCompletedAt ? "ready" : postCall ? "processing" : null,
          metadata: c.metadata,
        };
      }),
      analytics: metrics,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      agentId?: string;
      to?: string;
      contactId?: string;
      isTest?: boolean;
      dynamicVariables?: Record<string, unknown>;
    };
    if (!body.agentId || !body.to) {
      return NextResponse.json({ error: "agentId and to are required" }, { status: 400 });
    }
    const result = await initiateOutboundCall({
      workspaceId: auth.workspaceId,
      agentId: body.agentId,
      toPhone: body.to,
      contactId: body.contactId,
      isTest: body.isTest,
      dynamicVariables: body.dynamicVariables,
    });
    return NextResponse.json({ data: result.call }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
