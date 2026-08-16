import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { importTwilioNumbersIntoWorkspace } from "@/lib/numbers/twilio-number-import";

/**
 * Import Twilio incoming numbers into the active workspace (subaccount transfer + webhooks).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as {
      e164s?: string[];
      transferFromParent?: boolean;
    };

    const data = await importTwilioNumbersIntoWorkspace({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      e164s: body.e164s,
      transferFromParent: body.transferFromParent !== false,
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
