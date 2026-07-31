import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  duplicateVoiceAgent,
  publishVoiceAgent,
  updateVoiceAgentDraft,
} from "@/lib/voice/agent-service";
import { parseVoiceAgentConfig, VOICE_STATUS_MAP } from "@/lib/voice/types";

function mapAgent(row: Record<string, unknown>) {
  const r = row as {
    id: string;
    name: string;
    description: string | null;
    agentType: string;
    status: string;
    displayName: string | null;
    purpose: string | null;
    phoneNumberId: string | null;
    directions: string[];
    draftConfig: unknown;
    callsHandled: number;
    conversionRate: number;
    healthStatus: string;
    healthMessage: string | null;
    publishedVersionId: string | null;
    telnyxAssistantId: string | null;
    updatedAt: Date;
    createdAt: Date;
  };
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    agentType: r.agentType,
    status: VOICE_STATUS_MAP[r.status] || r.status,
    rawStatus: r.status,
    displayName: r.displayName,
    purpose: r.purpose,
    phoneNumberId: r.phoneNumberId,
    directions: r.directions,
    draftConfig: parseVoiceAgentConfig(r.draftConfig),
    callsHandled: r.callsHandled,
    conversionRate: r.conversionRate,
    healthStatus: r.healthStatus,
    healthMessage: r.healthMessage,
    publishedVersionId: r.publishedVersionId,
    telnyxAssistantId: r.telnyxAssistantId,
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const row = await getPrisma().voiceAgent.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const versions = await getPrisma().voiceAgentVersion.findMany({
      where: { agentId: id },
      orderBy: { version: "desc" },
      take: 20,
    });

    return NextResponse.json({
      data: {
        ...mapAgent(row),
        versions: versions.map((v: { id: string; version: number; publishedAt: Date; publishedBy: string | null }) => ({
          id: v.id,
          version: v.version,
          publishedAt: v.publishedAt.toISOString(),
          publishedBy: v.publishedBy,
        })),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === "duplicate") {
      const dup = await duplicateVoiceAgent(auth.workspaceId, id);
      return NextResponse.json({ data: mapAgent(dup) }, { status: 201 });
    }
    if (body.action === "publish") {
      const result = await publishVoiceAgent(auth.workspaceId, id, auth.session.userId);
      return NextResponse.json({
        data: mapAgent(result.agent),
        version: result.version.version,
      });
    }
    if (body.action === "pause") {
      const row = await getPrisma().voiceAgent.update({
        where: { id },
        data: { status: "PAUSED" },
      });
      return NextResponse.json({ data: mapAgent(row) });
    }
    if (body.action === "activate") {
      const row = await getPrisma().voiceAgent.update({
        where: { id },
        data: { status: "ACTIVE" },
      });
      return NextResponse.json({ data: mapAgent(row) });
    }
    if (body.action === "archive") {
      const row = await getPrisma().voiceAgent.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      return NextResponse.json({ data: mapAgent(row) });
    }

    const row = await updateVoiceAgentDraft(auth.workspaceId, id, {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      agentType: body.agentType as string | undefined,
      displayName: body.displayName as string | undefined,
      purpose: body.purpose as string | undefined,
      phoneNumberId: body.phoneNumberId as string | null | undefined,
      status: body.status as string | undefined,
      draftConfig: body.draftConfig as import("@/lib/voice/types").VoiceAgentConfig,
    });
    return NextResponse.json({ data: mapAgent(row) });
  } catch (err) {
    const issues = (err as Error & { issues?: unknown }).issues;
    if (issues) {
      return NextResponse.json({ error: "Validation failed", issues }, { status: 400 });
    }
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const existing = await getPrisma().voiceAgent.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().voiceAgent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
