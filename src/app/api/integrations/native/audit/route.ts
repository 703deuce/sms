import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listIntegrationActionLogs } from "@/lib/integrations/framework/action-log";
import {
  acknowledgeIntegrationAlert,
  listIntegrationAlerts,
  scanIntegrationHealth,
} from "@/lib/integrations/framework/alerts";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "actions";

    if (view === "alerts") {
      if (searchParams.get("scan") === "1") {
        await scanIntegrationHealth(auth.workspaceId);
      }
      const alerts = await listIntegrationAlerts(auth.workspaceId, {
        includeAcknowledged: searchParams.get("all") === "1",
      });
      return NextResponse.json({ data: { alerts } });
    }

    const logs = await listIntegrationActionLogs(auth.workspaceId, {
      provider: searchParams.get("provider") || undefined,
      source: searchParams.get("source") || undefined,
      actionId: searchParams.get("action") || undefined,
      status: searchParams.get("status") || undefined,
      contactId: searchParams.get("contactId") || undefined,
      limit: Number(searchParams.get("limit") || 100),
    });
    return NextResponse.json({ data: { logs } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { op?: string; alertId?: string };
    if (body.op === "ack" && body.alertId) {
      await acknowledgeIntegrationAlert(auth.workspaceId, body.alertId);
      return NextResponse.json({ data: { ok: true } });
    }
    if (body.op === "scan") {
      const raised = await scanIntegrationHealth(auth.workspaceId);
      return NextResponse.json({ data: { raised: raised.length } });
    }
    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 500);
  }
}
