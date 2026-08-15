import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  clearPortAwayWindow,
  parkPersonalNumber,
  reactivatePersonalNumber,
  setPersonalVoicemailEnabled,
} from "@/lib/workspace/personal-number-actions";

type Action =
  | "park"
  | "reactivate"
  | "keep"
  | "enable_voicemail"
  | "disable_voicemail";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { type: true },
    });
    if (workspace?.type !== "PERSONAL") {
      return NextResponse.json(
        { error: "Personal number actions require a Personal workspace." },
        { status: 403 },
      );
    }

    const { numberId } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: Action };
    const action = body.action;

    if (!action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    let data;
    switch (action) {
      case "park":
        data = await parkPersonalNumber(auth.workspaceId, numberId);
        break;
      case "reactivate":
        data = await reactivatePersonalNumber(auth.workspaceId, numberId);
        break;
      case "keep":
        data = await clearPortAwayWindow(auth.workspaceId, numberId);
        break;
      case "enable_voicemail":
        data = await setPersonalVoicemailEnabled(auth.workspaceId, numberId, true);
        break;
      case "disable_voicemail":
        data = await setPersonalVoicemailEnabled(auth.workspaceId, numberId, false);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
