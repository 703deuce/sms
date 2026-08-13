import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { createVoiceAgent } from "@/lib/voice/agent-service";
import { parseVoiceAgentConfig, VOICE_STATUS_MAP } from "@/lib/voice/types";

function mapAgent(row: {
  id: string;
  name: string;
  description: string | null;
  agentType: string;
  status: string;
  displayName: string | null;
  phoneNumberId: string | null;
  directions: string[];
  callsHandled: number;
  conversionRate: number;
  healthStatus: string;
  healthMessage: string | null;
  publishedVersionId: string | null;
  updatedAt: Date;
}, phone?: { e164: string } | null) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    agentType: row.agentType,
    status: VOICE_STATUS_MAP[row.status] || row.status,
    rawStatus: row.status,
    displayName: row.displayName,
    phoneNumberId: row.phoneNumberId,
    phoneE164: phone?.e164 || null,
    directions: row.directions,
    callsHandled: row.callsHandled,
    conversionRate: row.conversionRate,
    healthStatus: row.healthStatus,
    healthMessage: row.healthMessage,
    publishedVersionId: row.publishedVersionId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const where: Record<string, unknown> = { workspaceId: auth.workspaceId };
    if (status) where.status = status.toUpperCase();

    const rows = await getPrisma().voiceAgent.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    }) as Array<{
      id: string;
      name: string;
      description: string | null;
      agentType: string;
      status: string;
      displayName: string | null;
      phoneNumberId: string | null;
      directions: string[];
      callsHandled: number;
      conversionRate: number;
      healthStatus: string;
      healthMessage: string | null;
      publishedVersionId: string | null;
      updatedAt: Date;
    }>;
    const phoneIds = rows
      .map((r: { phoneNumberId: string | null }) => r.phoneNumberId)
      .filter((id: string | null): id is string => Boolean(id));
    const phones =
      phoneIds.length > 0
        ? await getPrisma().phoneNumber.findMany({
            where: { workspaceId: auth.workspaceId, id: { in: phoneIds } },
            select: { id: true, e164: true },
          })
        : [];
    const phoneById = new Map<string, { id: string; e164: string }>(
      phones.map((p: { id: string; e164: string }) => [p.id, p]),
    );
    return NextResponse.json({
      data: rows.map((row) => {
        const phone = row.phoneNumberId ? phoneById.get(row.phoneNumberId) : undefined;
        return mapAgent(row, phone?.e164 ? { e164: phone.e164 } : null);
      }),
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
      name?: string;
      agentType?: string;
      templateId?: string;
      description?: string;
    };
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const row = await createVoiceAgent(auth.workspaceId, {
      name,
      agentType: body.agentType,
      templateId: body.templateId,
      description: body.description,
    });
    return NextResponse.json({ data: mapAgent(row) }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
