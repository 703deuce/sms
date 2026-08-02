import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { importTelnyxNumbersIntoWorkspace } from "@/lib/voice/telnyx/number-import";
import { diagnoseAndRepairInboundNumber } from "@/lib/voice/telnyx/inbound-diagnostics";

/**
 * Import Telnyx-account numbers into the active workspace and attach voice connection.
 * Optionally diagnose/repair Call Control webhook routing (`repairInbound: true`).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as {
      e164s?: string[];
      attachConnection?: boolean;
      repairInbound?: boolean;
    };

    const data = await importTelnyxNumbersIntoWorkspace({
      workspaceId: auth.workspaceId,
      e164s: body.e164s,
      attachConnection: body.attachConnection !== false,
    });

    let inbound: unknown = null;
    if (body.repairInbound) {
      const target =
        body.e164s?.[0] ||
        data.imported.find((n) => n.attached)?.e164 ||
        data.imported[0]?.e164;
      if (target) {
        inbound = await diagnoseAndRepairInboundNumber({
          workspaceId: auth.workspaceId,
          e164: target,
          repair: true,
        });
      }
    }

    return NextResponse.json({ data: { ...data, inbound } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
