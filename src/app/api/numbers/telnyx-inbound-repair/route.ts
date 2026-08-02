import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { diagnoseAndRepairInboundNumber } from "@/lib/voice/telnyx/inbound-diagnostics";

const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";

/**
 * Diagnose (and optionally repair) Telnyx inbound PSTN routing for a DID.
 *
 * Auth: session cookie, or smoke bootstrap header (for live agent ops).
 * Body: { e164: "+1...", repair?: boolean, workspaceId?: string }
 * Note: production must redeploy (Coolify) before this route is live.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      e164?: string;
      repair?: boolean;
      workspaceId?: string;
    };
    const e164 = String(body.e164 || "").trim();
    if (!e164) {
      return NextResponse.json({ error: "e164 required" }, { status: 400 });
    }

    let workspaceId = "";
    if (request.headers.get(BOOTSTRAP_HEADER) === BOOTSTRAP_VALUE) {
      workspaceId = String(body.workspaceId || "ws_1").trim();
    } else {
      const auth = await requireSession();
      if ("error" in auth) return auth.error;
      workspaceId = auth.workspaceId;
    }

    const data = await diagnoseAndRepairInboundNumber({
      workspaceId,
      e164,
      repair: Boolean(body.repair),
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
