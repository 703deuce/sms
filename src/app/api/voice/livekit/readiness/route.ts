import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { isLiveKitVoiceRuntime } from "@/lib/voice/runtime-provider/config";
import {
  ensureNumberProvisioned,
  resolveLiveKitSipHost,
  verifyNumberRouting,
} from "@/lib/telephony/provisioning";
import { requireLiveKitEnv } from "@/lib/voice/runtime-provider/config";
import { RoomServiceClient } from "livekit-server-sdk";

/**
 * LiveKit connectivity + optional provision for the signed-in workspace.
 * POST { phoneNumberId?, agentId?, provision?: boolean }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as {
      phoneNumberId?: string;
      agentId?: string;
      provision?: boolean;
    };

    const sip = resolveLiveKitSipHost();
    const provider = isLiveKitVoiceRuntime() ? "livekit" : "telnyx";

    let livekitApi: { ok: boolean; detail: string } = { ok: false, detail: "skipped" };
    try {
      const { url, apiKey, apiSecret } = requireLiveKitEnv();
      const client = new RoomServiceClient(url, apiKey, apiSecret);
      const rooms = await client.listRooms();
      livekitApi = { ok: true, detail: `listRooms ok (${rooms.length} active)` };
    } catch (err) {
      livekitApi = {
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    let provisionResult = null;
    let verifyResult = null;

    if (body.provision && body.phoneNumberId) {
      provisionResult = await ensureNumberProvisioned({
        workspaceId: auth.workspaceId,
        phoneNumberId: body.phoneNumberId,
        agentId: body.agentId,
        routingMode: "livekit_sip",
      });
      verifyResult = await verifyNumberRouting({
        workspaceId: auth.workspaceId,
        phoneNumberId: body.phoneNumberId,
      });
    } else if (body.phoneNumberId) {
      verifyResult = await verifyNumberRouting({
        workspaceId: auth.workspaceId,
        phoneNumberId: body.phoneNumberId,
      });
    }

    return NextResponse.json({
      data: {
        provider,
        sipHost: sip.host ? { source: sip.source, configured: true } : { configured: false },
        livekitApi,
        provision: provisionResult,
        verify: verifyResult,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const prisma = getPrisma();
    const agents = await prisma.voiceAgent.findMany({
      where: { workspaceId: auth.workspaceId, status: "ACTIVE" },
      select: { id: true, name: true, phoneNumberId: true },
      take: 10,
    });

    const sip = resolveLiveKitSipHost();
    let livekitApi: { ok: boolean; detail: string } = { ok: false, detail: "skipped" };
    try {
      const { url, apiKey, apiSecret } = requireLiveKitEnv();
      const client = new RoomServiceClient(url, apiKey, apiSecret);
      await client.listRooms();
      livekitApi = { ok: true, detail: "connected" };
    } catch (err) {
      livekitApi = {
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    return NextResponse.json({
      data: {
        provider: isLiveKitVoiceRuntime() ? "livekit" : "telnyx",
        sipHost: sip,
        livekitApi,
        activeAgents: agents,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
