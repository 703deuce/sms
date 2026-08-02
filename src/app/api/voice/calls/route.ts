import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { initiateOutboundCall } from "@/lib/voice/call-service";

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

    const where: Record<string, unknown> = { workspaceId: auth.workspaceId };
    if (direction) where.direction = direction.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (isTest === "1") where.isTest = true;
    if (isTest === "0") where.isTest = false;
    if (q) {
      where.OR = [
        { fromE164: { contains: q } },
        { toE164: { contains: q } },
        { outcome: { contains: q, mode: "insensitive" } },
      ];
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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const baseWhere = { workspaceId: auth.workspaceId, isTest: isTest === "1" };
    const [todayCount, handledToday, transferredToday, leadsToday, avgAgg] =
      await Promise.all([
        prisma.voiceCall.count({
          where: { ...baseWhere, startedAt: { gte: startOfDay } },
        }),
        prisma.voiceCall.count({
          where: {
            ...baseWhere,
            startedAt: { gte: startOfDay },
            answeredAt: { not: null },
          },
        }),
        prisma.voiceCall.count({
          where: {
            ...baseWhere,
            startedAt: { gte: startOfDay },
            transferred: true,
          },
        }),
        prisma.voiceCall.count({
          where: {
            ...baseWhere,
            startedAt: { gte: startOfDay },
            leadScore: { gte: 40 },
          },
        }),
        prisma.voiceCall.aggregate({
          where: {
            ...baseWhere,
            startedAt: { gte: startOfDay },
            durationSeconds: { not: null },
          },
          _avg: { durationSeconds: true },
        }),
      ]);

    return NextResponse.json({
      data: rows.map((c: (typeof rows)[number]) => {
        const insight = c.insights?.[0] || null;
        const contact = c.contactId ? contactMap.get(c.contactId) : null;
        const contactName = contact
          ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
          : null;
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
          hasRecording: (c.recordings?.length || 0) > 0,
          hasTranscript: (c.transcripts?.length || 0) > 0,
        };
      }),
      analytics: {
        today: todayCount,
        aiHandledToday: handledToday,
        transferredToday,
        leadsToday,
        avgDurationSecToday: avgAgg._avg.durationSeconds
          ? Math.round(avgAgg._avg.durationSeconds)
          : null,
      },
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
