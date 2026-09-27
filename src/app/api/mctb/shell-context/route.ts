import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadMctbShellContextData } from "@/lib/mctb/shell-context-data";

/** Lightweight MCTB chrome context — no Telnyx sync, no compliance sweep. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const data = await loadMctbShellContextData(workspaceId);

  return NextResponse.json({
    data: {
      workspaceName: data.workspaceName,
      businessLineE164: data.businessLineE164,
      senderE164: data.senderE164,
      senderLabel: data.senderLabel,
      timezone: data.timezone,
    },
  });
}
