import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { executeVoiceV2FindAvailability } from "@/lib/voice-v2/find-availability";

function resolveWorkspaceId(request: Request, body: Record<string, unknown>): string | null {
  const headerWs = request.headers.get("x-transovo-workspace-id")?.trim();
  if (headerWs) return headerWs;
  const bodyWs = String(body.workspace_id || body.workspaceId || "").trim();
  return bodyWs || null;
}

function authorizeVoiceV2(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const cron = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (cron && bearer === cron) return { ok: true };
  return { ok: false, status: 401, error: "unauthorized" };
}

/**
 * Voice Booking V2 — isolated FIND_AVAILABILITY baseline (no durable ops / orchestrator).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    let workspaceId: string | null = null;
    const cronAuth = authorizeVoiceV2(request);
    if (cronAuth.ok) {
      workspaceId = resolveWorkspaceId(request, body);
      if (!workspaceId) {
        return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
      }
    } else {
      const auth = await requireSession();
      if ("error" in auth) return auth.error;
      workspaceId = auth.workspaceId || resolveWorkspaceId(request, body);
      if (!workspaceId) {
        return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
      }
    }

    const result = await executeVoiceV2FindAvailability(body, workspaceId);
    const httpStatus = result.status === "ERROR" ? 502 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err) {
    return jsonError(err, 500);
  }
}
