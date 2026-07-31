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

    const where: Record<string, unknown> = { workspaceId: auth.workspaceId };
    if (direction) where.direction = direction.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (isTest === "1") where.isTest = true;
    if (isTest === "0") where.isTest = false;

    const rows = await getPrisma().voiceCall.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      data: rows.map((c: {
        id: string;
        direction: string;
        status: string;
        outcome: string | null;
        fromE164: string;
        toE164: string;
        agentId: string | null;
        campaignId: string | null;
        contactId: string | null;
        durationSeconds: number | null;
        leadScore: number | null;
        appointmentBooked: boolean;
        transferred: boolean;
        voicemailDetected: boolean;
        costCents: number;
        isTest: boolean;
        startedAt: Date;
        endedAt: Date | null;
      }) => ({
        id: c.id,
        direction: c.direction,
        status: c.status,
        outcome: c.outcome,
        fromE164: c.fromE164,
        toE164: c.toE164,
        agentId: c.agentId,
        campaignId: c.campaignId,
        contactId: c.contactId,
        durationSeconds: c.durationSeconds,
        leadScore: c.leadScore,
        appointmentBooked: c.appointmentBooked,
        transferred: c.transferred,
        voicemailDetected: c.voicemailDetected,
        costCents: c.costCents,
        isTest: c.isTest,
        startedAt: c.startedAt.toISOString(),
        endedAt: c.endedAt?.toISOString() ?? null,
      })),
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
