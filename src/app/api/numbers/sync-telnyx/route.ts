import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { importTelnyxNumbersIntoWorkspace } from "@/lib/voice/telnyx/number-import";

/**
 * Import Telnyx-account numbers into the active workspace and attach voice connection.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as {
      e164s?: string[];
      attachConnection?: boolean;
    };

    const data = await importTelnyxNumbersIntoWorkspace({
      workspaceId: auth.workspaceId,
      e164s: body.e164s,
      attachConnection: body.attachConnection !== false,
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
