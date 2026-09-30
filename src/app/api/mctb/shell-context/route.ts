import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadMctbShellContextData } from "@/lib/mctb/shell-context-data";

/** Lightweight MCTB chrome context — plan, usage, phone/sender summary (no Telnyx sweep). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const data = await loadMctbShellContextData(workspaceId);

  return NextResponse.json({
    data: {
      workspaceName: data.workspaceName,
      businessLineE164: data.businessLineE164,
      forwardingIngressE164: data.forwardingIngressE164,
      forwardingIngressState: data.forwardingIngressState,
      senderMode: data.senderMode,
      senderE164: data.senderE164,
      senderLabel: data.senderLabel,
      senderDetail: data.senderDetail,
      timezone: data.timezone,
      planUsage: data.planUsage,
      capabilities: data.capabilities,
    },
  });
}
